import React, { useEffect, useId, useRef, useState } from 'react';
import { Info } from '../icons';

interface ContextHelpProps {
  title: string;
  children: React.ReactNode;
  tone?: 'blue' | 'mint' | 'lilac' | 'peach';
}

const ContextHelp: React.FC<ContextHelpProps> = ({ title, children }) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="dr-context-help"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="dr-help-button"
        aria-label={`${title} yardimini ${open ? 'kapat' : 'ac'}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <span id={panelId} role="tooltip" className="dr-help-popover">
          <span className="dr-help-body">{children}</span>
        </span>
      )}
    </span>
  );
};

export default ContextHelp;
