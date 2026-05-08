import React from 'react';
import type { ExamScheduleEntry, Task, WeeklyScheduleSlot } from '../../types';
import { Clock, GraduationCap, Sparkles } from '../icons';
import ParentWorkspaceFrame from './ParentWorkspaceFrame';

interface ParentOverviewSummary {
  completedCount: number;
  studiedMinutes: number;
  weakTopics: Array<{
    key: string;
    courseName: string;
    topicName: string;
  }>;
  lastCompletedTask: Task | null;
}

interface ParentOverviewWorkspaceProps {
  parentSummary: {
    pendingCount: number;
    overdueCount: number;
    completedCount: number;
  };
  overviewSummary: ParentOverviewSummary;
  overviewNextTask: Task | undefined;
  overviewUpcomingExam: ExamScheduleEntry | undefined;
  overviewTodayName: string;
  overviewTodaySlots: WeeklyScheduleSlot[];
  overviewSignal: {
    title: string;
    text: string;
    className: string;
  };
  overviewExamDecision: {
    title: string;
    detail: string;
    action: string;
    tone: string;
  };
  lastCompletedTaskLabel: string | null;
  onOpenPlanning: (message: string) => void;
}

const ParentOverviewWorkspace: React.FC<ParentOverviewWorkspaceProps> = ({
  parentSummary,
  overviewSummary,
  overviewNextTask,
  overviewUpcomingExam,
  overviewTodayName,
  overviewTodaySlots,
  overviewSignal,
  overviewExamDecision,
  lastCompletedTaskLabel,
  onOpenPlanning,
}) => (
  <ParentWorkspaceFrame
    title="Anlık Öğrenci Pozisyonu"
    description="Ebeveyn paneli durum özeti"
    spacing="wide"
    actions={
      <div className="ios-panel flex items-center gap-2 rounded-[20px] p-1">
        <button onClick={() => onOpenPlanning('Planlama açıldı.')} className="ios-button rounded-[16px] px-4 py-2 text-xs font-black text-slate-700">Planlama</button>
        <button onClick={() => onOpenPlanning('Aktif plan takibi açıldı.')} className="ios-button-active rounded-[16px] px-4 py-2 text-xs font-black">Aktif plan</button>
      </div>
    }
  >
    <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
      <div className="ios-widget ios-blue rounded-[24px] p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bugünkü Görev</p>
        <div className="mt-2 text-2xl font-black text-slate-900">{overviewNextTask ? overviewNextTask.title : 'Yok'}</div>
        <p className="mt-2 text-xs font-semibold text-slate-500">{overviewNextTask ? overviewNextTask.dueDate : 'Planlama bekleniyor'}</p>
      </div>
      <div className="ios-widget ios-peach rounded-[24px] p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bekleyen</p>
        <div className="mt-2 text-3xl font-black text-slate-900">{parentSummary.pendingCount}</div>
      </div>
      <div className="ios-widget ios-coral rounded-[24px] p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Geciken</p>
        <div className="mt-2 text-3xl font-black text-rose-950">{parentSummary.overdueCount}</div>
      </div>
      <div className="ios-widget ios-mint rounded-[24px] p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tamamlanan</p>
        <div className="mt-2 text-3xl font-black text-emerald-950">{parentSummary.completedCount}</div>
      </div>
      <div className="ios-widget ios-lilac rounded-[24px] p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Yaklaşan Sınav</p>
        <div className="mt-2 text-xl font-black text-violet-950">{overviewExamDecision.title}</div>
        <p className="mt-2 text-xs font-semibold text-slate-500">{overviewExamDecision.detail}</p>
      </div>
    </section>

    <section className="grid grid-cols-12 gap-6">
      <div className="col-span-12 space-y-6 lg:col-span-8">
        <div className="ios-card rounded-[30px] p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-900">Bugünün ders akışı</h3>
              <p className="mt-1 text-sm text-slate-500">{overviewTodayName} programı sadece okunur özet olarak gösterilir.</p>
            </div>
            <Clock className="h-5 w-5 text-slate-400" />
          </div>
          <div className="space-y-3">
            {overviewTodaySlots.length === 0 ? (
              <div className="ios-widget rounded-[22px] p-5 text-sm text-slate-500">Bugün için tanımlı ders akışı yok. Programı Planlama sayfasından düzenleyebilirsiniz.</div>
            ) : overviewTodaySlots.map((slot) => (
              <div key={slot.id} className="ios-widget rounded-[22px] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-black text-slate-900">{slot.courseName}</div>
                    {slot.note && <div className="mt-1 text-xs text-slate-500">{slot.note}</div>}
                  </div>
                  <span className="dr-time-chip rounded-full px-3 py-1 text-xs font-black">{slot.startTime} - {slot.endTime}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-[30px] p-6 ${overviewSignal.className}`}>
          <div className="text-xs font-black uppercase tracking-[0.18em] opacity-80">Kısa analiz sinyali</div>
          <h3 className="mt-2 text-2xl font-black">{overviewSignal.title}</h3>
          <p className="mt-2 max-w-2xl text-sm font-semibold opacity-80">{overviewSignal.text}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[20px] bg-white/35 p-4">
              <div className="text-[11px] font-black uppercase opacity-70">Çalışma</div>
              <div className="mt-2 text-2xl font-black">{overviewSummary.completedCount}</div>
            </div>
            <div className="rounded-[20px] bg-white/35 p-4">
              <div className="text-[11px] font-black uppercase opacity-70">Süre</div>
              <div className="mt-2 text-2xl font-black">{overviewSummary.studiedMinutes} dk</div>
            </div>
            <div className="rounded-[20px] bg-white/35 p-4">
              <div className="text-[11px] font-black uppercase opacity-70">Odak konusu</div>
              <div className="mt-2 text-2xl font-black">{overviewSummary.weakTopics.length}</div>
            </div>
          </div>
        </div>
      </div>

      <aside className="col-span-12 flex flex-col gap-6 lg:col-span-4">
        <div className="ios-ink group relative overflow-hidden rounded-[30px] p-6 text-white">
          <div className="relative z-10">
            <h3 className="mb-2 text-lg font-bold">Sıradaki adım</h3>
            <p className="mb-4 text-sm text-white/80">{overviewNextTask ? overviewNextTask.title : 'Yeni hedef için planlama sayfasına geçin.'}</p>
            <button onClick={() => onOpenPlanning(overviewNextTask ? 'Aktif plan açıldı.' : 'Planlama açıldı.')} className="ios-button-active flex items-center gap-2 rounded-[18px] px-4 py-2 text-sm font-bold transition-all group-hover:gap-3">
              {overviewNextTask ? 'Aktif Planda Gör' : 'Planlama'} <span aria-hidden="true">&gt;</span>
            </button>
          </div>
          <div className="absolute -bottom-4 -right-4 text-[110px] font-black leading-none text-white/10">+</div>
        </div>

        <div className="ios-widget rounded-[26px] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-bold">Son Aktivite</h4>
            <Clock className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-slate-300" />
            <p className="text-xs text-slate-400 italic">{overviewSummary.lastCompletedTask && lastCompletedTaskLabel ? lastCompletedTaskLabel : 'Kayıtlı aktivite bulunamadı.'}</p>
          </div>
        </div>

        <div className="ios-widget rounded-[26px] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-bold">Yaklaşan Sınav</h4>
            <GraduationCap className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-sm font-black text-slate-900">{overviewExamDecision.title}</p>
          <p className="mt-1 text-xs text-slate-500">{overviewExamDecision.detail}</p>
          <div className={`mt-3 rounded-[18px] px-3 py-2 text-xs font-bold ${overviewExamDecision.tone}`}>{overviewExamDecision.action}</div>
          <button onClick={() => onOpenPlanning(overviewUpcomingExam ? 'Sınav takvimi açıldı.' : 'Planlama açıldı.')} className="mt-3 ios-button rounded-[16px] px-3 py-2 text-xs font-black text-slate-700">
            Planlamada Gör
          </button>
        </div>

        <div className="ios-widget rounded-[26px] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-bold">Odak Konuları</h4>
            <Sparkles className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex flex-col gap-3">
            {overviewSummary.weakTopics.length === 0 ? (
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-slate-300" />
                <p className="text-xs text-slate-400 italic">Analiz için veri bekleniyor.</p>
              </div>
            ) : (
              overviewSummary.weakTopics.slice(0, 3).map((topic) => (
                <div key={`weak-${topic.key}`} className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-rose-300" />
                  <p className="truncate text-xs text-slate-500">{topic.courseName} / {topic.topicName}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </section>
  </ParentWorkspaceFrame>
);

export default ParentOverviewWorkspace;
