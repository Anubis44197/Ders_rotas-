import React, { useEffect, useState } from 'react';
import { ParentLockScreenProps } from '../../types';
import { Lock } from '../icons';

const ParentLockScreen: React.FC<ParentLockScreenProps> = ({ onUnlock, error }) => {
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (password.length === 4) {
      onUnlock(password);
    }
  }, [password, onUnlock]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onUnlock(password);
  };

  return (
    <div className="flex min-h-[calc(100vh-81px)] items-center justify-center px-4 py-10">
      <div className="ios-card w-full max-w-md rounded-[28px] p-8 text-center">
        <div className="ios-ink mx-auto inline-flex h-20 w-20 items-center justify-center rounded-[24px] text-slate-800">
          <Lock className="h-9 w-9" />
        </div>
        <div className="mt-6">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-primary-600">Ebeveyn Alani</div>
          <h2 className="dr-title mt-2 text-3xl font-black text-slate-900">Panel kilitli.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Mufredat, planlama ve analiz ekranlarini acmak icin sifreni gir.</p>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="****"
            autoFocus
            className="ios-button w-full rounded-[20px] px-4 py-4 text-center text-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default ParentLockScreen;
