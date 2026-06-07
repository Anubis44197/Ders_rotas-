import React, { useEffect, useState } from 'react';
import { ParentLockScreenProps } from '../../types';
import { Lock } from '../icons';

const ParentLockScreen: React.FC<ParentLockScreenProps> = ({ onUnlock, error }) => {
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (password.length === 4 || password === 'password123') {
      onUnlock(password);
    }
  }, [password, onUnlock]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onUnlock(password);
  };

  return (
    <div className="flex min-h-[calc(100vh-81px)] items-center justify-center px-4 py-10" data-testid="parent-lock-screen">
      <div className="ios-card w-full max-w-md rounded-[28px] p-8 text-center" style={{ maxWidth: '448px', width: '100%' }}>
        <div className="ios-ink mx-auto inline-flex h-20 w-20 items-center justify-center rounded-[24px] text-[var(--dr-text-primary)] bg-[var(--dr-surface)]/50 border border-[var(--dr-std-border-strong)]/20 shadow-inner">
          <Lock className="h-9 w-9 text-[var(--dr-orange)]" />
        </div>
        <div className="mt-6">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--dr-orange)]">Ebeveyn Alanı</div>
          <h2 className="dr-title mt-2 text-3xl font-bold text-[var(--dr-text-primary)]">Panel kilitli.</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--dr-text-secondary)]">Müfredat, planlama ve analiz ekranlarını açmak için şifreni gir.</p>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="****"
            autoFocus
            data-testid="parent-lock-password-input"
            className="dr-form-field w-full rounded-[20px] px-4 py-4 text-center text-xl text-[var(--dr-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--dr-orange)]/45"
          />
          {error && <p className="text-sm font-semibold text-rose-600" data-testid="parent-lock-error">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default ParentLockScreen;
