import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message }) => {
  return (
    <div className="dr-panel flex h-full flex-col items-center justify-center rounded-[24px] border border-dashed border-primary-200 bg-gradient-to-br from-white via-primary-50 to-sky-50 p-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-600 shadow-sm">
        {icon}
      </div>
      <h3 className="text-lg font-black text-slate-800">{title}</h3>
      <p className="max-w-xs leading-relaxed text-slate-600">{message}</p>
      <div className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-primary-500">Yeni veriler geldikce burada gorunecek</div>
    </div>
  );
};

export default EmptyState;
