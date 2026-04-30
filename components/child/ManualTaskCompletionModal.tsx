import React, { useMemo, useState } from 'react';
import { Task, TaskCompletionData } from '../../types';

interface ManualTaskCompletionModalProps {
  show: boolean;
  onClose: () => void;
  task: Task;
  onComplete: (taskId: string, data: TaskCompletionData) => void;
}

const getDefaultTimes = () => ({ start: '17:00', end: '18:00' });

const ManualTaskCompletionModal: React.FC<ManualTaskCompletionModalProps> = ({ show, onClose, task, onComplete }) => {
  const defaults = useMemo(() => getDefaultTimes(), []);
  const [startTime, setStartTime] = useState(defaults.start);
  const [endTime, setEndTime] = useState(defaults.end);
  const [pagesRead, setPagesRead] = useState('');
  const [correctCount, setCorrectCount] = useState('');
  const [incorrectCount, setIncorrectCount] = useState('');
  const [emptyCount, setEmptyCount] = useState('');
  const [selfAssessmentScore, setSelfAssessmentScore] = useState('');
  const [error, setError] = useState('');

  const totalQuestions = (Number(correctCount) || 0) + (Number(incorrectCount) || 0) + (Number(emptyCount) || 0);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!startTime || !endTime) {
      setError('Baslangic ve bitis saatini gir.');
      return;
    }

    const start = new Date(`${task.dueDate}T${startTime}`);
    const end = new Date(`${task.dueDate}T${endTime}`);
    if (end <= start) {
      setError('Bitis saati baslangictan sonra olmali.');
      return;
    }

    const completionData: TaskCompletionData = {
      actualDuration: Math.floor((end.getTime() - start.getTime()) / 1000),
      breakTime: 0,
      pauseTime: 0,
      selfAssessmentScore: selfAssessmentScore ? Number(selfAssessmentScore) : undefined,
    };

    if (task.taskType === 'kitap okuma') {
      if (!pagesRead || Number(pagesRead) <= 0) {
        setError('Okunan sayfa sayisini gir.');
        return;
      }
      completionData.pagesRead = Number(pagesRead);
    }

    if (task.taskType === 'soru çözme') {
      if (task.questionCount && totalQuestions !== task.questionCount) {
        setError(`Toplam ${task.questionCount} soru olmali.`);
        return;
      }
      completionData.correctCount = Number(correctCount) || 0;
      completionData.incorrectCount = Number(incorrectCount) || 0;
      completionData.emptyCount = Number(emptyCount) || 0;
    }

    onComplete(task.id, completionData);
    onClose();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <form className="ios-card w-full max-w-xl rounded-[28px] p-6" onSubmit={handleSubmit}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Gecmis kayit</div>
            <h3 className="mt-1 text-2xl font-black text-slate-900">Gorevi manuel tamamla</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Bu gorev gecmis tarihte yapildiysa sure ve sonuc bilgisini buradan gir.</p>
          </div>
          <button type="button" onClick={onClose} className="ios-button rounded-full px-3 py-2 text-sm font-bold text-slate-500">Kapat</button>
        </div>

        <div className="ios-widget mb-5 rounded-[24px] p-4">
          <div className="text-sm font-bold text-slate-900">{task.bookTitle || task.title}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-full bg-white px-3 py-1">{task.dueDate}</span>
            <span className="rounded-full bg-white px-3 py-1">{task.plannedDuration} dk plan</span>
            {task.questionCount ? <span className="rounded-full bg-white px-3 py-1">{task.questionCount} soru</span> : null}
            {task.curriculumUnitName ? <span className="rounded-full bg-white px-3 py-1">Unite: {task.curriculumUnitName}</span> : null}
            {task.curriculumTopicName ? <span className="rounded-full bg-white px-3 py-1">Konu: {task.curriculumTopicName}</span> : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
          <section className="ios-widget ios-blue rounded-[24px] p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Sure bilgisi</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-slate-700">
                Baslama
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="ios-button mt-1 w-full rounded-[18px] px-3 py-3" required />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Bitis
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="ios-button mt-1 w-full rounded-[18px] px-3 py-3" required />
              </label>
            </div>
          </section>

          <section className="ios-widget ios-mint rounded-[24px] p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Sonuc bilgisi</div>
            <div className="space-y-3">
              {task.taskType === 'kitap okuma' && (
                <label className="text-sm font-semibold text-slate-700">
                  Okunan sayfa
                  <input type="number" min="1" value={pagesRead} onChange={(e) => setPagesRead(e.target.value)} className="ios-button mt-1 w-full rounded-[18px] px-3 py-3" required />
                </label>
              )}

              {task.taskType === 'soru çözme' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="text-sm font-semibold text-emerald-700">
                    Dogru
                    <input type="number" min="0" max={task.questionCount} value={correctCount} onChange={(e) => setCorrectCount(e.target.value)} className="ios-button mt-1 w-full rounded-[18px] px-3 py-3 text-slate-800" required />
                  </label>
                  <label className="text-sm font-semibold text-rose-700">
                    Yanlis
                    <input type="number" min="0" max={task.questionCount} value={incorrectCount} onChange={(e) => setIncorrectCount(e.target.value)} className="ios-button mt-1 w-full rounded-[18px] px-3 py-3 text-slate-800" required />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Bos
                    <input type="number" min="0" max={task.questionCount} value={emptyCount} onChange={(e) => setEmptyCount(e.target.value)} className="ios-button mt-1 w-full rounded-[18px] px-3 py-3 text-slate-800" required />
                  </label>
                  <div className="ios-widget sm:col-span-3 rounded-[18px] px-3 py-3 text-sm text-slate-600">Toplam: <strong>{totalQuestions}</strong> / {task.questionCount}</div>
                </div>
              )}

              {task.taskType === 'ders çalışma' && <div className="ios-widget rounded-[18px] px-3 py-3 text-sm text-slate-600">Bu gorevde sure bilgisi yeterli. Odak ve verim sonraki analizde hesaplanir.</div>}

              {task.taskType !== 'kitap okuma' && (
                <label className="text-sm font-semibold text-slate-700">
                  Baslamadan once bu konuda kendine kac puan verirdin? (0-100)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={selfAssessmentScore}
                    onChange={(e) => setSelfAssessmentScore(e.target.value)}
                    className="ios-button mt-1 w-full rounded-[18px] px-3 py-3"
                    placeholder="Opsiyonel"
                  />
                </label>
              )}
            </div>
          </section>
        </div>

        {error && <div className="ios-coral mt-4 rounded-[18px] px-4 py-3 text-sm font-semibold text-rose-900">{error}</div>}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="ios-button rounded-[18px] px-5 py-3 text-sm font-bold text-slate-700">Iptal</button>
          <button type="submit" className="ios-mint rounded-[18px] px-5 py-3 text-sm font-bold text-emerald-950">Kaydet ve tamamla</button>
        </div>
      </form>
    </div>
  );
};

export default ManualTaskCompletionModal;
