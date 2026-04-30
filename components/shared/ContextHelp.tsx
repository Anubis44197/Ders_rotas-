import React, { useId, useState } from 'react';
import { Info, X } from '../icons';

interface ContextHelpProps {
  title: string;
  children: React.ReactNode;
  tone?: 'blue' | 'mint' | 'lilac' | 'peach';
}

const toneClassMap: Record<NonNullable<ContextHelpProps['tone']>, string> = {
  blue: 'ios-blue',
  mint: 'ios-mint',
  lilac: 'ios-lilac',
  peach: 'ios-peach',
};

const ContextHelp: React.FC<ContextHelpProps> = ({ title, children, tone = 'blue' }) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <span className="dr-context-help">
      <button
        type="button"
        className="dr-help-button"
        aria-label={`${title} yardimini ${open ? 'kapat' : 'ac'}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <span id={panelId} role="status" className={`dr-help-popover ${toneClassMap[tone]}`}>
          <span className="dr-help-title">{title}</span>
          <span className="dr-help-body">{children}</span>
          <button type="button" className="dr-help-close" aria-label="Yardimi kapat" onClick={() => setOpen(false)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
    </span>
  );
};

export default ContextHelp;
