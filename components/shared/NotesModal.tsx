import React, { useState } from 'react';
import { X, FileText } from '../icons';

interface NotesModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
  taskName: string;
  initialNote?: string;
}

const NotesModal: React.FC<NotesModalProps> = ({
  show,
  onClose,
  onSave,
  taskName,
  initialNote = '',
}) => {
  const [note, setNote] = useState(initialNote);

  if (!show) return null;

  const handleSave = () => {
    onSave(note);
    onClose();
  };

  const handleClose = () => {
    setNote(initialNote);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 backdrop-blur-[3px] p-4" onClick={handleClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="ios-card w-full rounded-[22px] p-5 bg-slate-900 border border-slate-800 shadow-2xl backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="notes-modal-title" style={{ maxWidth: '356px', width: '100%', margin: '0 auto' }} onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            <h3 id="notes-modal-title" className="text-lg font-black text-white">Not Ekle</h3>
          </div>
          <button onClick={handleClose} aria-label="Kapat" title="Kapat" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="session-note" className="mb-1.5 block text-xs font-semibold text-slate-300">
              <span className="font-bold text-white">{taskName}</span> görevi için not
            </label>
            <textarea
              id="session-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nerede kaldığını, neyi hatırlamak istediğini veya sonraki adımı yaz..."
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs px-3 py-2 rounded-[12px] focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder-slate-600 resize-none"
              maxLength={500}
              rows={4}
            />
            <div className="mt-1.5 flex justify-between items-center text-[10px] text-slate-500">
              <span>Uzun notlar kendi alanında kaydırılır.</span>
              <span>{note.length}/500</span>
            </div>
          </div>

          <div className="mt-4 flex gap-2 w-full">
            <button onClick={handleClose} className="flex-1 rounded-[12px] px-4 py-2.5 text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition">
              İptal
            </button>
            <button
              onClick={handleSave}
              className="flex-1 rounded-[12px] px-4 py-2.5 text-xs font-bold transition hover:opacity-90 active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: '1px solid #1e40af',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
              }}
            >
              Kaydet ve Devam Et
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesModal;
