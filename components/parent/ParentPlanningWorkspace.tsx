import React from 'react';
import type { Course, ExamScheduleEntry, SubjectCurriculum, Task, WeeklySchedule } from '../../types';
import { BookOpen, Calendar, ClipboardList, PlusCircle, Trash2 } from '../icons';
import WeeklySchedulePanel from './WeeklySchedulePanel';
import { getTodayString } from '../../utils/dateUtils';
import ContextHelp from '../shared/ContextHelp';

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
  examScheduleEntries: ExamScheduleEntry[];
  courses: Course[];
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'status'>) => Promise<Task>;
  onChangeSchedule: (schedule: WeeklySchedule) => void;
  onChangeExamSchedules: React.Dispatch<React.SetStateAction<ExamScheduleEntry[]>>;
  onOpenCurriculumEditor: () => void;
  onReactivateCourse: (courseId: string) => void;
  courseReferenceHealth: CourseReferenceHealth;
}

const defaultCourseReferenceHealth: CourseReferenceHealth = {
  taskCount: 0,
  examRecordCount: 0,
  compositeExamCount: 0,
  examScheduleCount: 0,
  performanceCount: 0,
  scheduleBlockCount: 0,
};

const ParentPlanningWorkspace: React.FC<ParentPlanningWorkspaceProps> = ({
  curriculum,
  curriculumSummary,
  weeklySchedule,
  examScheduleEntries,
  courses,
  tasks,
  addTask,
  onChangeSchedule,
  onChangeExamSchedules,
  onOpenCurriculumEditor,
  onReactivateCourse,
  courseReferenceHealth = defaultCourseReferenceHealth,
}) => {
  const [isExamModalOpen, setIsExamModalOpen] = React.useState(false);
  const [selectedExamCourseId, setSelectedExamCourseId] = React.useState('');
  const [examNameInput, setExamNameInput] = React.useState('');
  const [examDateInput, setExamDateInput] = React.useState('');
  const [examNoteInput, setExamNoteInput] = React.useState('');

  const safeCourses = Array.isArray(courses) ? courses : [];

  const handleAddExamSchedule = () => {
    const course = safeCourses.find((item) => item.id === selectedExamCourseId);
    if (!course || !examNameInput.trim() || !examDateInput) {
      alert("Lütfen ders, sınav adı ve tarih alanlarını doldurun.");
      return;
    }
    const nextEntry: ExamScheduleEntry = {
      id: `exam_schedule_${course.id}_${examDateInput}_${Date.now()}`,
      examName: examNameInput.trim(),
      date: examDateInput,
      note: examNoteInput.trim() || undefined,
      courseId: course.id,
      courseName: course.name,
    };
    onChangeExamSchedules((prev) => [...prev, nextEntry]);
    setSelectedExamCourseId('');
    setExamNameInput('');
    setExamDateInput('');
    setExamNoteInput('');
    setIsExamModalOpen(false);
  };
  const safeCurriculumSummary = {
    subjects: Array.isArray(curriculumSummary?.subjects) ? curriculumSummary.subjects : [],
    unitCount: Number(curriculumSummary?.unitCount) || 0,
    topicCount: Number(curriculumSummary?.topicCount) || 0,
    completedTopicCount: Number(curriculumSummary?.completedTopicCount) || 0,
  };
  const safeCourseReferenceHealth = courseReferenceHealth || defaultCourseReferenceHealth;
  const activeCourses = safeCourses.filter((course) => course.active !== false);
  const inactiveCourses = safeCourses.filter((course) => course.active === false);
  const brokenReferenceTotal = Object.values(safeCourseReferenceHealth).reduce((sum, count) => sum + count, 0);
  const today = getTodayString();

  // Sınav takvimi — tarih sıralı, geçmiş sınavlar altta
  const sortedExamEntries = [...(Array.isArray(examScheduleEntries) ? examScheduleEntries : [])]
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcomingExams = sortedExamEntries.filter((e) => e.date >= today);
  const pastExams = sortedExamEntries.filter((e) => e.date < today);
  return (
    <div className="dr-planning-workspace space-y-5">
      <section className="dr-planning-hero flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="dr-planning-title dr-hig-large-title text-[var(--dr-text-primary)]">Zaman ve Görevler</h2>
            <ContextHelp title="Zaman ve Görevler" tone="blue">
              Ders, okul programı ve çalışma zemini ile görevler yönetilir.
            </ContextHelp>
          </div>
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

      <section className="ios-card rounded-[24px] p-6 border border-[var(--dr-std-border-strong)]/20 shadow-md bg-[var(--dr-surface)]/40 backdrop-blur-lg">
        <div className="dr-planning-card-head flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 dr-hig-caption font-bold uppercase tracking-[0.18em] text-[var(--dr-orange)]">
              <BookOpen className="h-4 w-4" />
              Müfredat
            </div>
            <div className="mt-2 flex items-center gap-2">
              <h3 className="dr-planning-section-title dr-hig-headline text-[var(--dr-text-primary)]">Müfredat Yönetimi</h3>
              <ContextHelp title="Müfredat Yönetimi" tone="blue">
                Ders ekle/kaldır, pasif dersi geri al. Bu listedeki dersler görev atama ve analiz ekranlarında kullanılır.
              </ContextHelp>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenCurriculumEditor}
            className="ios-button-active inline-flex items-center justify-center gap-2 rounded-[16px] px-5 py-3 text-sm font-black text-white transition-all active:scale-[0.96] cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            Ders Ekle / Kaldır
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="ios-widget rounded-[20px] border border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/60 px-4 py-4 shadow-inner">
            <div className="dr-hig-caption font-bold uppercase text-[var(--dr-text-secondary)]">Aktif ders</div>
            <div className="mt-2 dr-hig-title text-[var(--dr-text-primary)]">{activeCourses.length}</div>
          </div>
          <div className="ios-widget rounded-[20px] border border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/60 px-4 py-4 shadow-inner">
            <div className="dr-hig-caption font-bold uppercase text-[var(--dr-text-secondary)]">Ünite</div>
            <div className="mt-2 dr-hig-title text-[var(--dr-text-primary)]">{safeCurriculumSummary.unitCount}</div>
          </div>
          <div className="ios-widget rounded-[20px] border border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/60 px-4 py-4 shadow-inner">
            <div className="dr-hig-caption font-bold uppercase text-[var(--dr-text-secondary)]">Konu</div>
            <div className="mt-2 dr-hig-title text-[var(--dr-text-primary)]">{safeCurriculumSummary.topicCount}</div>
          </div>
          <div className="ios-widget rounded-[20px] border border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/60 px-4 py-4 shadow-inner">
            <div className="dr-hig-caption font-bold uppercase text-[var(--dr-text-secondary)]">Tamamlanan</div>
            <div className="mt-2 dr-hig-title text-[var(--dr-text-primary)]">{safeCurriculumSummary.completedTopicCount}</div>
          </div>
        </div>

        {safeCurriculumSummary.subjects.length === 0 ? (
          <div className="mt-4 rounded-[18px] border border-dashed border-[var(--dr-std-border-strong)]/20 bg-[var(--dr-surface)]/30 px-4 py-4 text-sm font-semibold text-[var(--dr-text-secondary)]">
            Henüz ders eklenmedi. Görev atama ve analiz için önce müfredat iskeleti tanımlanmalı.
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {safeCurriculumSummary.subjects.slice(0, 8).map((subject) => (
              <span key={subject} className="ios-widget inline-flex min-height-[2rem] items-center rounded-full border border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/50 px-3 py-1.5 text-xs font-bold text-[var(--dr-text-primary)]">
                {subject}
              </span>
            ))}
            {safeCurriculumSummary.subjects.length > 8 && (
              <span className="ios-widget inline-flex min-height-[2rem] items-center rounded-full border border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/50 px-3 py-1.5 text-xs font-bold text-[var(--dr-text-primary)]">+{safeCurriculumSummary.subjects.length - 8}</span>
            )}
          </div>
        )}

        {inactiveCourses.length > 0 && (
          <div className="mt-5 rounded-[22px] border border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/30 p-4 backdrop-blur-md">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--dr-text-secondary)]">Pasif dersler</div>
                <p className="mt-1 text-sm text-[var(--dr-text-secondary)]">Yeni plan ve veri girişlerinde görünmez; geçmiş kayıtlar korunur.</p>
              </div>
              <span className="ios-button rounded-full px-3 py-2 text-xs font-black text-[var(--dr-text-primary)]">{inactiveCourses.length} ders</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {inactiveCourses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => onReactivateCourse(course.id)}
                  className="ios-button rounded-full px-3 py-2 text-xs font-bold text-[var(--dr-text-primary)] transition-all active:scale-[0.96] cursor-pointer"
                  title={`${course.name} dersini tekrar aktif et`}
                >
                  {course.name} - tekrar aktif et
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <WeeklySchedulePanel schedule={weeklySchedule} courses={safeCourses} curriculum={curriculum} addTask={addTask} onSave={onChangeSchedule} onAddExam={() => setIsExamModalOpen(true)} />

      {isExamModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-xl transition-all">
          <div className="ios-card dr-compact-modal flex max-h-[min(30rem,calc(100dvh-1.5rem))] w-[min(30rem,calc(100vw-1.5rem))] flex-col overflow-hidden border border-[var(--dr-std-border-strong)]/20 shadow-2xl" role="dialog" aria-modal="true" aria-label="Sınav takvimi ekle">
            <div className="flex items-center justify-between border-b border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/20 px-4 py-3">
              <h2 className="text-lg font-black text-[var(--dr-text-primary)]">Sınav Ekle</h2>
              <button type="button" onClick={() => setIsExamModalOpen(false)} className="ios-button flex h-9 w-9 items-center justify-center rounded-full text-[var(--dr-text-secondary)] transition-all active:scale-[0.96] cursor-pointer" aria-label="Sınav formunu kapat">
                ✕
              </button>
            </div>
            <div className="dr-modal-scroll dr-compact-modal-body flex-1 space-y-3 overflow-y-auto p-4 bg-[var(--dr-surface)]/20">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-[var(--dr-text-secondary)]">Ders Seçin</label>
                <select value={selectedExamCourseId} onChange={(event) => setSelectedExamCourseId(event.target.value)} className="dr-form-field w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none">
                  <option value="">Ders Seçiniz</option>
                  {safeCourses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-[var(--dr-text-secondary)]">Sınav Adı</label>
                <input value={examNameInput} onChange={(event) => setExamNameInput(event.target.value)} placeholder="Örn: 1. Dönem 1. Yazılı" className="dr-form-field w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-[var(--dr-text-secondary)]">Tarih</label>
                <input value={examDateInput} onChange={(event) => setExamDateInput(event.target.value)} type="date" className="dr-form-field w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-[var(--dr-text-secondary)]">Not (İsteğe Bağlı)</label>
                <input value={examNoteInput} onChange={(event) => setExamNoteInput(event.target.value)} placeholder="Hedef konular veya notlar..." className="dr-form-field w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/20 px-4 py-3">
              <button type="button" onClick={() => setIsExamModalOpen(false)} className="ios-button rounded-xl px-3 py-2 text-xs font-bold text-[var(--dr-text-primary)] transition-all active:scale-[0.96] cursor-pointer" aria-label="Sınav eklemeyi iptal et">İptal</button>
              <button type="button" onClick={handleAddExamSchedule} className="ios-button-active inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold text-white transition-all active:scale-[0.96] cursor-pointer">
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="ios-card rounded-[24px] p-6 border border-[var(--dr-std-border-strong)]/20 shadow-md bg-[var(--dr-surface)]/40 backdrop-blur-lg">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[var(--dr-orange)]" />
            <h3 className="dr-planning-section-title dr-hig-headline text-[var(--dr-text-primary)]">Sınav Takvimi</h3>
          </div>
          <span className="ios-button rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--dr-text-secondary)] border border-[var(--dr-std-border-strong)]/15">
            {upcomingExams.length} yaklaşan · {pastExams.length} geçmiş
          </span>
        </div>

        {sortedExamEntries.length === 0 ? (
          <div className="mt-4 rounded-[18px] border border-dashed border-[var(--dr-std-border-strong)]/20 bg-[var(--dr-surface)]/30 p-8 text-center text-sm font-semibold text-[var(--dr-text-secondary)]">
            Henüz sınav eklenmedi. Yukarıdaki "Sınav ekle" butonunu kullanarak okul sınavlarını takvime ekleyebilirsiniz.
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingExams.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--dr-orange)]">Yaklaşan Sınavlar</div>
                <div className="space-y-2">
                  {upcomingExams.map((exam) => {
                    const daysLeft = Math.round((new Date(`${exam.date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={exam.id} className="ios-widget rounded-[20px] border border-[var(--dr-std-border-strong)]/15 border-l-[3px] border-l-[var(--dr-orange)] bg-[var(--dr-surface)]/50 p-4 flex items-center justify-between gap-3 shadow-sm">
                        <div className="min-w-0">
                          <div className="text-sm font-black text-[var(--dr-text-primary)]">{exam.examName}</div>
                          <div className="mt-0.5 text-xs font-semibold text-[var(--dr-text-secondary)]">{exam.courseName} · {exam.date}</div>
                          {exam.note && <div className="mt-1 text-xs text-[var(--dr-text-secondary)]/80">{exam.note}</div>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            daysLeft <= 3 ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                            daysLeft <= 7 ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                            'bg-[var(--dr-orange)]/10 text-[var(--dr-orange)] border border-[var(--dr-orange)]/20'
                          }`}>
                            {daysLeft === 0 ? 'Bugün' : daysLeft === 1 ? 'Yarın' : `${daysLeft} gün`}
                          </span>
                          <button
                            type="button"
                            onClick={() => onChangeExamSchedules((prev) => prev.filter((e) => e.id !== exam.id))}
                            className="dr-destructive-button flex h-8 w-8 items-center justify-center rounded-full p-0 transition-all active:scale-[0.92] cursor-pointer"
                            title="Sınavı sil"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {pastExams.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--dr-text-secondary)]">Geçmiş Sınavlar</div>
                <div className="space-y-2">
                  {pastExams.slice().reverse().map((exam) => (
                    <div key={exam.id} className="ios-widget rounded-[20px] border border-[var(--dr-std-border-strong)]/15 border-l-[3px] border-l-[var(--dr-text-secondary)]/30 bg-[var(--dr-surface)]/30 p-4 flex items-center justify-between gap-3 opacity-75 shadow-sm">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[var(--dr-text-primary)]/80">{exam.examName}</div>
                        <div className="mt-0.5 text-xs font-semibold text-[var(--dr-text-secondary)]">{exam.courseName} · {exam.date}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onChangeExamSchedules((prev) => prev.filter((e) => e.id !== exam.id))}
                        className="dr-destructive-button flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 transition-all active:scale-[0.92] cursor-pointer"
                        title="Sınavı sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default ParentPlanningWorkspace;
