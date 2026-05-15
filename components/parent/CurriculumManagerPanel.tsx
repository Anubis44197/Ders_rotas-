import React, { useEffect, useMemo, useState } from 'react';
import type { SubjectCurriculum } from '../../types';
import { BookOpen, PlusCircle, CheckCircle, Sparkles, Trash2 } from '../icons';

interface CurriculumManagerPanelProps {
  curriculum: SubjectCurriculum;
  onSave: (curriculum: SubjectCurriculum) => void;
}

const cloneCurriculum = (curriculum: SubjectCurriculum): SubjectCurriculum => JSON.parse(JSON.stringify(curriculum || {}));
const normalizeSubjectName = (value: string) =>
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
const fieldClass = 'dr-form-field rounded-2xl px-3 py-3 text-sm outline-none';
const primaryButtonClass = 'ios-button-active rounded-2xl px-4 py-3 text-sm font-bold';
const iconPrimaryButtonClass = 'ios-button-active rounded-2xl px-3 py-3';
const destructiveIconButtonClass = 'dr-destructive-button rounded-full p-2';

const CurriculumManagerPanel: React.FC<CurriculumManagerPanelProps> = ({ curriculum, onSave }) => {
  const [draft, setDraft] = useState<SubjectCurriculum>(() => cloneCurriculum(curriculum));
  const [activeSubject, setActiveSubject] = useState<string>(() => Object.keys(curriculum)[0] || '');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newUnitNames, setNewUnitNames] = useState<Record<string, string>>({});
  const [newTopicNames, setNewTopicNames] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(cloneCurriculum(curriculum));
    setActiveSubject((prev) => {
      if (prev && curriculum[prev]) return prev;
      return Object.keys(curriculum)[0] || '';
    });
  }, [curriculum]);

  const subjects = useMemo(() => Object.keys(draft), [draft]);
  const activeUnits = activeSubject ? draft[activeSubject] || [] : [];
  const totalUnitCount = subjects.reduce((sum, subject) => sum + (draft[subject]?.length || 0), 0);
  const totalTopicCount = subjects.reduce((sum, subject) => sum + (draft[subject] || []).reduce((unitSum, unit) => unitSum + unit.topics.length, 0), 0);
  const completedTopicCount = subjects.reduce((sum, subject) => sum + (draft[subject] || []).reduce((unitSum, unit) => unitSum + unit.topics.filter((topic) => topic.completed).length, 0), 0);
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(curriculum);

  const handleAddSubject = () => {
    const subjectName = newSubjectName.trim();
    const existingSubject = Object.keys(draft).find((subject) => normalizeSubjectName(subject) === normalizeSubjectName(subjectName));
    if (!subjectName) return;
    if (existingSubject) {
      setActiveSubject(existingSubject);
      setNewSubjectName('');
      return;
    }

    const next = {
      ...draft,
      [subjectName]: [],
    };

    setDraft(next);
    setActiveSubject(subjectName);
    setNewSubjectName('');
    setSaved(false);
  };

  const handleDeleteSubject = (subjectName: string) => {
    const next = cloneCurriculum(draft);
    delete next[subjectName];
    setDraft(next);
    if (activeSubject === subjectName) {
      const fallback = Object.keys(next)[0] || '';
      setActiveSubject(fallback);
    }
    setSaved(false);
  };

  const handleAddUnit = (subjectName: string) => {
    const unitName = (newUnitNames[subjectName] || '').trim();
    if (!unitName) return;

    const next = cloneCurriculum(draft);
    next[subjectName] = next[subjectName] || [];
    next[subjectName].push({ name: unitName, topics: [] });
    setDraft(next);
    setNewUnitNames((prev) => ({ ...prev, [subjectName]: '' }));
    setSaved(false);
  };

  const handleDeleteUnit = (subjectName: string, unitIndex: number) => {
    const next = cloneCurriculum(draft);
    next[subjectName].splice(unitIndex, 1);
    setDraft(next);
    setSaved(false);
  };

  const handleAddTopic = (subjectName: string, unitIndex: number) => {
    const key = `${subjectName}-${unitIndex}`;
    const topicName = (newTopicNames[key] || '').trim();
    if (!topicName) return;

    const next = cloneCurriculum(draft);
    next[subjectName][unitIndex].topics.push({ name: topicName, completed: false });
    setDraft(next);
    setNewTopicNames((prev) => ({ ...prev, [key]: '' }));
    setSaved(false);
  };

  const handleDeleteTopic = (subjectName: string, unitIndex: number, topicIndex: number) => {
    const next = cloneCurriculum(draft);
    next[subjectName][unitIndex].topics.splice(topicIndex, 1);
    setDraft(next);
    setSaved(false);
  };

  const handleToggleTopic = (subjectName: string, unitIndex: number, topicIndex: number) => {
    const next = cloneCurriculum(draft);
    const topic = next[subjectName][unitIndex].topics[topicIndex];
    topic.completed = !topic.completed;
    setDraft(next);
    setSaved(false);
  };

  const handleSave = () => {
    onSave(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <section className="ios-card rounded-[28px] p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary-600">
            <BookOpen className="h-4 w-4" />
            Müfredat Editörü
          </div>
          <h2 className="mt-2 text-3xl font-black text-slate-900">Ders / ünite / konu yapısı</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Bu alan sadece ebeveyn tarafında görünür. Görev atama ve plan üretimi için temel akademik iskelet burada tanımlanır.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="ios-widget rounded-[22px] px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Ders</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{subjects.length}</div>
          </div>
          <div className="ios-widget rounded-[22px] px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Ünite</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{totalUnitCount}</div>
          </div>
          <div className="ios-widget rounded-[22px] px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Konu</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{totalTopicCount}</div>
          </div>
          <div className="ios-widget ios-mint rounded-[22px] px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Tamamlanan</div>
            <div className="mt-2 text-2xl font-bold">{completedTopicCount}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="ios-widget rounded-[24px] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-800">Dersler</div>
              <div className="text-xs text-slate-500">Aktif dersi seç, ünite ve konu düzenle.</div>
            </div>
            <div className="ios-button rounded-full px-2.5 py-1 text-xs font-semibold text-slate-600">{subjects.length}</div>
          </div>

          <div className="mb-4 flex gap-2">
            <input
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Yeni ders"
              className={`min-w-0 flex-1 ${fieldClass}`}
            />
            <button onClick={handleAddSubject} className={`${iconPrimaryButtonClass} inline-flex items-center gap-2`} title="Ders ekle">
              <PlusCircle className="h-4 w-4" />
              <span className="text-sm font-black">Ekle</span>
            </button>
          </div>

          <div className="space-y-2">
            {subjects.length === 0 && <p className="ios-widget rounded-2xl px-4 py-4 text-sm text-slate-500">Henüz ders eklenmedi.</p>}
            {subjects.map((subject) => {
              const isActive = activeSubject === subject;
              const unitCount = draft[subject]?.length || 0;
              const topicCount = (draft[subject] || []).reduce((sum, unit) => sum + unit.topics.length, 0);
              return (
                <div key={subject} className={`rounded-2xl transition ${isActive ? 'ios-button-active' : 'ios-button text-slate-700'}`}>
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <button onClick={() => setActiveSubject(subject)} className="min-w-0 flex-1 text-left">
                      <div className="truncate font-bold">{subject}</div>
                      <div className={`mt-1 text-xs ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>{unitCount} ünite • {topicCount} konu</div>
                    </button>
                    <button onClick={() => handleDeleteSubject(subject)} className={isActive ? 'inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-2 text-xs font-black text-white hover:bg-white/25' : `${destructiveIconButtonClass} inline-flex items-center gap-1 text-xs font-black`} title="Dersi sil">
                      <Trash2 className="h-4 w-4" />
                      <span>Sil</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0">
          {!activeSubject ? (
            <div className="ios-widget rounded-[24px] border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Önce bir ders ekleyin veya soldan bir ders seçin.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="ios-widget rounded-[24px] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.22em] text-primary-600">Aktif Ders</div>
                    <h3 className="mt-2 text-2xl font-black text-slate-900">{activeSubject}</h3>
                    <p className="mt-1 text-sm text-slate-500">Önce üniteyi kur, sonra konu listesini netleştir. Tamamlanan konular burada işaretlenir.</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newUnitNames[activeSubject] || ''}
                      onChange={(e) => setNewUnitNames((prev) => ({ ...prev, [activeSubject]: e.target.value }))}
                      placeholder="Yeni ünite"
                      className={fieldClass}
                    />
                    <button onClick={() => handleAddUnit(activeSubject)} className={primaryButtonClass}>
                      Ünite Ekle
                    </button>
                  </div>
                </div>
              </div>

              {activeUnits.length === 0 && (
                <div className="ios-widget rounded-[24px] border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
                  Bu ders için henüz ünite eklenmedi.
                </div>
              )}

              <div className="space-y-4">
                {activeUnits.map((unit, unitIndex) => {
                  const topicKey = `${activeSubject}-${unitIndex}`;
                  const completedCount = unit.topics.filter((topic) => topic.completed).length;
                  return (
                    <div key={`${activeSubject}-${unit.name}-${unitIndex}`} className="ios-widget rounded-[24px] p-5">
                      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-xl font-black text-slate-900">{unit.name}</div>
                            <button onClick={() => handleDeleteUnit(activeSubject, unitIndex)} className={destructiveIconButtonClass} title="Üniteyi sil">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-1 text-sm text-slate-500">{unit.topics.length} konu • {completedCount} tamamlanan</div>
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={newTopicNames[topicKey] || ''}
                            onChange={(e) => setNewTopicNames((prev) => ({ ...prev, [topicKey]: e.target.value }))}
                            placeholder="Yeni konu"
                            className={fieldClass}
                          />
                          <button onClick={() => handleAddTopic(activeSubject, unitIndex)} className={primaryButtonClass}>
                            Konu Ekle
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {unit.topics.length === 0 && <div className="ios-widget rounded-2xl px-4 py-4 text-sm text-slate-500">Bu ünite için konu eklenmedi.</div>}
                        {unit.topics.map((topic, topicIndex) => (
                          <div key={`${topic.name}-${topicIndex}`} className="ios-widget flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm text-slate-700">
                            <div className="min-w-0">
                              <div className={`font-semibold ${topic.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{topic.name}</div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleTopic(activeSubject, unitIndex, topicIndex)}
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${topic.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                              >
                                <CheckCircle className="mr-1 h-4 w-4" />
                                {topic.completed ? 'Tamamlandı' : 'Açık'}
                              </button>
                              <button onClick={() => handleDeleteTopic(activeSubject, unitIndex, topicIndex)} className={destructiveIconButtonClass} title="Konuyu sil">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`ios-widget mt-6 flex flex-col gap-3 rounded-[24px] px-5 py-4 transition ${hasChanges ? 'ios-blue' : ''}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Sparkles className="h-4 w-4 text-primary-600" />
              Kayıt Durumu
            </div>
            <div className="mt-1 text-sm text-slate-500">{hasChanges ? 'Kaydedilmemiş değişiklikler var.' : saved ? 'Müfredat kaydedildi.' : 'Güncel müfredat kayıtlı.'}</div>
          </div>
          <button
            onClick={handleSave}
            className={`rounded-2xl px-5 py-3 text-sm font-bold transition ${saved ? 'ios-button' : 'ios-button-active'}`}
          >
            {saved ? 'Kaydedildi' : 'Müfredatı Kaydet'}
          </button>
        </div>
      </div>
    </section>
  );
};

export default CurriculumManagerPanel;
