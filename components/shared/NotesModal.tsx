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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" onClick={handleClose}>
      <div className="ios-card w-full max-w-lg rounded-[28px] p-6" role="dialog" aria-modal="true" aria-labelledby="notes-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 id="notes-modal-title" className="text-xl font-bold text-slate-900">Not Ekle</h3>
          </div>
          <button onClick={handleClose} aria-label="Kapat" title="Kapat" className="ios-button flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:text-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="session-note" className="mb-2 block text-sm font-semibold text-slate-700">
              <span className="font-bold text-slate-900">{taskName}</span> gorevi icin not
            </label>
            <textarea
              id="session-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nerede kaldigini, neyi hatirlamak istedigini veya sonraki adimi yaz..."
              className="dr-text-view"
              maxLength={500}
              rows={5}
            />
            <div className="dr-text-view-meta mt-2">
              <span>Uzun notlar kendi alaninda kaydirilir.</span>
              <span>{note.length}/500</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button onClick={handleClose} className="ios-button flex-1 rounded-[18px] px-4 py-3 font-bold text-slate-700">
              Iptal
            </button>
            <button onClick={handleSave} className="ios-button-active flex-1 rounded-[18px] px-4 py-3 font-black">
              Kaydet ve Devam Et
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesModal;
