import React, { useEffect, useMemo, useState } from 'react';
import type { Course, WeeklySchedule, WeeklyScheduleSlot } from '../../types';
import { Calendar, CheckCircle, Clock, PlusCircle, Trash2, X } from '../icons';

interface WeeklySchedulePanelProps {
  schedule: WeeklySchedule;
  courses: Course[];
  onSave: (schedule: WeeklySchedule) => void;
}

const DAYS = ['Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi', 'Pazar'];

const createEmptyDay = () => ({
  slots: [],
  confirmed: false,
});

const resolveScheduleDay = (value: WeeklySchedule[string] | string | undefined) => {
  if (!value) return createEmptyDay();
  if (typeof value === 'string') return createEmptyDay();
  return {
    slots: Array.isArray(value.slots) ? value.slots : [],
    confirmed: Boolean(value.confirmed),
  };
};

const createSlotId = () => `slot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const sortSlots = (slots: WeeklyScheduleSlot[]) => [...slots].sort((left, right) => left.startTime.localeCompare(right.startTime));

const WeeklySchedulePanel: React.FC<WeeklySchedulePanelProps> = ({ schedule, courses, onSave }) => {
  const [draft, setDraft] = useState<WeeklySchedule>(schedule);
  const [saved, setSaved] = useState(false);
  const [activeDay, setActiveDay] = useState<string>('Pazartesi');
  const [selectedCourseName, setSelectedCourseName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  useEffect(() => {
    setDraft(schedule);
  }, [schedule]);

  useEffect(() => {
    if (!selectedCourseName && courses.length > 0) {
      setSelectedCourseName(courses[0].name);
    }
  }, [courses, selectedCourseName]);

  const activeDaySchedule = resolveScheduleDay(draft[activeDay]);
  const updateDay = (day: string, updater: (current: WeeklySchedule[string]) => WeeklySchedule[string]) => {
    setDraft((prev) => {
      const currentDay = resolveScheduleDay(prev[day]);
      return {
        ...prev,
        [day]: updater(currentDay),
      };
    });
    if (saved) setSaved(false);
  };

  const resetEditor = () => {
    setStartTime('09:00');
    setEndTime('10:00');
    setNote('');
    setError('');
  };

  const handleAddSlot = () => {
    if (!selectedCourseName) {
      setError('Once bir ders secin.');
      return;
    }

    if (startTime >= endTime) {
      setError('Bitis saati baslangic saatinden sonra olmali.');
      return;
    }

    updateDay(activeDay, (currentDay) => ({
      slots: sortSlots([
        ...currentDay.slots,
        {
          id: createSlotId(),
          courseName: selectedCourseName,
          startTime,
          endTime,
          note: note.trim() || undefined,
        },
      ]),
      confirmed: false,
    }));

    resetEditor();
  };

  const handleRemoveSlot = (day: string, slotId: string) => {
    updateDay(day, (currentDay) => ({
      slots: currentDay.slots.filter((slot) => slot.id !== slotId),
      confirmed: false,
    }));
  };

  const handleConfirmDay = (day: string) => {
    updateDay(day, (currentDay) => ({
      ...currentDay,
      confirmed: true,
    }));
  };

  const handleMarkDayEmpty = (day: string) => {
    updateDay(day, () => ({
      slots: [],
      confirmed: true,
    }));
  };

  const handleSave = () => {
    onSave(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary-600">
            <Calendar className="h-4 w-4" />
            Haftalik Ders Akisi
          </div>
          <h2 className="mt-2 text-3xl font-black text-slate-900">Haftalik ders programi</h2>
        </div>
        <div className="flex flex-col items-stretch gap-3 xl:items-end">
          <button
            type="button"
            onClick={() => setIsEditorOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <PlusCircle className="h-4 w-4 text-primary-600" />
            Ders girisini ac
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex justify-end">
              <div className={`rounded-full px-3 py-1 text-xs font-bold ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {saved ? 'Kaydedildi' : 'Taslak'}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {DAYS.map((day) => {
                const dayState = resolveScheduleDay(draft[day]);
                const isActiveDay = day === activeDay;
                return (
                  <div key={`summary-${day}`} className={`min-h-[220px] rounded-[20px] border p-4 shadow-sm transition ${isActiveDay ? 'border-primary-500 bg-primary-50' : 'border-slate-200 bg-white'}`}>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-black text-slate-900">{day}</div>
                        <div className="text-xs text-slate-500">{dayState.slots.length === 0 ? 'Ders girilmedi' : `${dayState.slots.length} ders`}</div>
                      </div>
                      <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${dayState.confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {dayState.confirmed ? 'Onayli' : 'Taslak'}
                      </div>
                    </div>

                    <div className="mb-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDay(day);
                          setIsEditorOpen(true);
                        }}
                        className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        {dayState.slots.length === 0 ? 'Ders gir' : 'Duzenle'}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {dayState.slots.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">Bu gun icin ders blogu yok.</div>
                      ) : (
                        sortSlots(dayState.slots).map((slot) => (
                          <div key={slot.id} className="rounded-2xl border-l-4 border-blue-500 bg-slate-50 px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700">{slot.startTime} - {slot.endTime}</div>
                                <div className="mt-1 text-sm font-bold text-slate-900">{slot.courseName}</div>
                                {slot.note && <div className="mt-1 text-xs text-slate-500">{slot.note}</div>}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveSlot(day, slot.id)}
                                className="rounded-full bg-rose-50 p-2 text-rose-700 hover:bg-rose-100"
                                title="Ders blogunu sil"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          className={`rounded-2xl px-5 py-3 text-sm font-bold text-white transition ${saved ? 'bg-emerald-600' : 'bg-primary-600 hover:bg-primary-700'}`}
        >
          {saved ? 'Program Kaydedildi' : 'Haftalik Programi Kaydet'}
        </button>
      </div>

      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onClick={() => setIsEditorOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary-600">
                  <PlusCircle className="h-4 w-4" />
                  Ders girisi
                </div>
                <h3 className="mt-2 text-2xl font-black text-slate-900">{activeDay} duzenleme alani</h3>
                <p className="mt-1 text-sm text-slate-500">Gun sec, saat gir, blogu ekle ve gunu onayla.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                aria-label="Ders girisini kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-110px)] overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => {
                    const dayState = resolveScheduleDay(draft[day]);
                    const active = day === activeDay;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setActiveDay(day)}
                        className={`rounded-full border px-3 py-2 text-left text-sm font-bold transition ${active ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                      >
                        {day}
                        <span className={`ml-2 text-xs font-medium ${active ? 'text-blue-100' : 'text-slate-500'}`}>{dayState.slots.length} blok</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                    <div className="text-sm font-bold text-slate-800">{activeDay}</div>
                    <div className="text-xs text-slate-500">Saat ve ders bilgisi gir</div>
                  </div>
                  <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${activeDaySchedule.confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {activeDaySchedule.confirmed ? 'Onaylandi' : 'Onay bekliyor'}
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_110px_110px_minmax(0,1fr)_170px]">
                <select
                  value={selectedCourseName}
                  onChange={(event) => setSelectedCourseName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                >
                  <option value="">Ders sec</option>
                  {courses.map((course, index) => (
                    <option key={`${course.id}-${course.name}-${index}`} value={course.name}>{course.name}</option>
                  ))}
                </select>
                <input value={startTime} onChange={(event) => setStartTime(event.target.value)} type="time" className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
                <input value={endTime} onChange={(event) => setEndTime(event.target.value)} type="time" className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Not (istege bagli)"
                  className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
                <button onClick={handleAddSlot} className="flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700">
                  <PlusCircle className="h-4 w-4" />
                  Blogu Ekle
                </button>
                </div>

                {error && <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}

                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleConfirmDay(activeDay)}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {activeDaySchedule.slots.length > 0 ? 'Gunu Onayla' : 'Bos Gun Olarak Onayla'}
                    </button>
                    <button
                      onClick={() => handleMarkDayEmpty(activeDay)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
                    >
                      Bu Gunde Ders Yok
                    </button>
                  </div>

                  <div className="min-w-0 flex-1 lg:max-w-[520px]">
                    <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{activeDay} bloklari</div>
                    <div className="space-y-2">
                      {activeDaySchedule.slots.length === 0 ? (
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Bu gun icin henuz ders blogu eklenmedi.</div>
                      ) : (
                        sortSlots(activeDaySchedule.slots).map((slot) => (
                          <div key={`detail-${slot.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-900">{slot.courseName}</div>
                              <div className="mt-1 text-xs text-slate-500">{slot.startTime} - {slot.endTime}{slot.note ? ` • ${slot.note}` : ''}</div>
                            </div>
                            <button onClick={() => handleRemoveSlot(activeDay, slot.id)} className="rounded-full bg-rose-50 p-2 text-rose-700 hover:bg-rose-100" title="Ders blogunu sil">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default WeeklySchedulePanel;
