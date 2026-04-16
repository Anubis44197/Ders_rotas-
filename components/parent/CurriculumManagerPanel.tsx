import React, { useEffect, useMemo, useState } from 'react';
import type { SubjectCurriculum } from '../../types';
import { BookOpen, PlusCircle, CheckCircle, Sparkles, Trash2 } from '../icons';

interface CurriculumManagerPanelProps {
  curriculum: SubjectCurriculum;
  onSave: (curriculum: SubjectCurriculum) => void;
}

const cloneCurriculum = (curriculum: SubjectCurriculum): SubjectCurriculum => JSON.parse(JSON.stringify(curriculum || {}));

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
    if (!subjectName || draft[subjectName]) return;

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
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary-600">
            <BookOpen className="h-4 w-4" />
            Mufredat Editoru
          </div>
          <h2 className="mt-2 text-3xl font-black text-slate-900">Ders / unite / konu yapisi</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Bu alan sadece ebeveyn tarafinda gorunur. Gorev atama ve plan uretimi icin temel akademik iskelet burada tanimlanir.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Ders</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{subjects.length}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Unite</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{totalUnitCount}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Konu</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{totalTopicCount}</div>
          </div>
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white">
            <div className="text-xs font-semibold uppercase text-slate-300">Tamamlanan</div>
            <div className="mt-2 text-2xl font-bold">{completedTopicCount}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-800">Dersler</div>
              <div className="text-xs text-slate-500">Aktif dersi sec, unite ve konu duzenle.</div>
            </div>
            <div className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{subjects.length}</div>
          </div>

          <div className="mb-4 flex gap-2">
            <input
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Yeni ders"
              className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
            <button onClick={handleAddSubject} className="rounded-2xl bg-slate-900 px-3 py-3 text-white" title="Ders ekle">
              <PlusCircle className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {subjects.length === 0 && <p className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-500">Henuz ders eklenmedi.</p>}
            {subjects.map((subject) => {
              const isActive = activeSubject === subject;
              const unitCount = draft[subject]?.length || 0;
              const topicCount = (draft[subject] || []).reduce((sum, unit) => sum + unit.topics.length, 0);
              return (
                <div key={subject} className={`rounded-2xl transition ${isActive ? 'bg-primary-600 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100'}`}>
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <button onClick={() => setActiveSubject(subject)} className="min-w-0 flex-1 text-left">
                      <div className="truncate font-bold">{subject}</div>
                      <div className={`mt-1 text-xs ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>{unitCount} unite • {topicCount} konu</div>
                    </button>
                    <button onClick={() => handleDeleteSubject(subject)} className={`rounded-full p-2 ${isActive ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-700'}`} title="Dersi sil">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0">
          {!activeSubject ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
              Once bir ders ekleyin veya soldan bir ders secin.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.22em] text-primary-600">Aktif Ders</div>
                    <h3 className="mt-2 text-2xl font-black text-slate-900">{activeSubject}</h3>
                    <p className="mt-1 text-sm text-slate-500">Once uniteyi kur, sonra konu listesini netlestir. Tamamlanan konular burada isaretlenir.</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newUnitNames[activeSubject] || ''}
                      onChange={(e) => setNewUnitNames((prev) => ({ ...prev, [activeSubject]: e.target.value }))}
                      placeholder="Yeni unite"
                      className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                    <button onClick={() => handleAddUnit(activeSubject)} className="rounded-2xl bg-primary-600 px-4 py-3 text-sm font-bold text-white">
                      Unite Ekle
                    </button>
                  </div>
                </div>
              </div>

              {activeUnits.length === 0 && (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
                  Bu ders icin henuz unite eklenmedi.
                </div>
              )}

              <div className="space-y-4">
                {activeUnits.map((unit, unitIndex) => {
                  const topicKey = `${activeSubject}-${unitIndex}`;
                  const completedCount = unit.topics.filter((topic) => topic.completed).length;
                  return (
                    <div key={`${activeSubject}-${unit.name}-${unitIndex}`} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-xl font-black text-slate-900">{unit.name}</div>
                            <button onClick={() => handleDeleteUnit(activeSubject, unitIndex)} className="rounded-full bg-rose-50 p-2 text-rose-700 hover:bg-rose-100" title="Uniteyi sil">
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
                            className="rounded-2xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                          />
                          <button onClick={() => handleAddTopic(activeSubject, unitIndex)} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
                            Konu Ekle
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {unit.topics.length === 0 && <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">Bu unite icin konu eklenmedi.</div>}
                        {unit.topics.map((topic, topicIndex) => (
                          <div key={`${topic.name}-${topicIndex}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
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
                                {topic.completed ? 'Tamamlandi' : 'Acik'}
                              </button>
                              <button onClick={() => handleDeleteTopic(activeSubject, unitIndex, topicIndex)} className="rounded-full bg-rose-50 p-2 text-rose-700 hover:bg-rose-100" title="Konuyu sil">
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

      <div className={`mt-6 flex flex-col gap-3 rounded-[24px] border px-5 py-4 transition ${hasChanges ? 'border-primary-200 bg-primary-50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Sparkles className="h-4 w-4 text-primary-600" />
              Kayit Durumu
            </div>
            <div className="mt-1 text-sm text-slate-500">{hasChanges ? 'Kaydedilmemis degisiklikler var.' : saved ? 'Mufredat kaydedildi.' : 'Guncel mufredat kayitli.'}</div>
          </div>
          <button
            onClick={handleSave}
            className={`rounded-2xl px-5 py-3 text-sm font-bold text-white transition ${saved ? 'bg-emerald-600' : 'bg-primary-600 hover:bg-primary-700'}`}
          >
            {saved ? 'Kaydedildi' : 'Mufredati Kaydet'}
          </button>
        </div>
      </div>
    </section>
  );
};

export default CurriculumManagerPanel;
