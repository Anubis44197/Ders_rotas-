import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message }) => {
  return (
    <div className="ios-card flex h-full min-h-[280px] flex-col items-center justify-center rounded-[28px] p-8 text-center">
      <div className="relative mb-5 flex h-24 w-24 items-center justify-center" aria-hidden="true">
        <div className="absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.75),transparent_36%),linear-gradient(135deg,var(--dr-blue-soft),var(--dr-purple-soft))] shadow-[0_18px_40px_rgba(86,104,145,0.14)]" />
        <div className="absolute left-5 top-6 h-2 w-12 rounded-full bg-white/70" />
        <div className="absolute left-5 top-11 h-2 w-8 rounded-full bg-white/55" />
        <div className="absolute bottom-5 right-5 h-8 w-8 rounded-full border border-white/70 bg-white/45" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/70 text-primary-600 shadow-sm">
          {icon}
        </div>
      </div>
      <h3 className="text-lg font-black text-slate-800">{title}</h3>
      <p className="max-w-xs leading-relaxed text-slate-600">{message}</p>
      <div className="mt-4 rounded-full bg-white/55 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary-500">Veri geldikce guncellenir</div>
    </div>
  );
};

export default EmptyState;
