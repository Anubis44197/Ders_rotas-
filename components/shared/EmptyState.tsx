import React from 'react';
import { BarChart as BarChartIcon } from '../icons';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-10 bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border-2 border-dashed border-primary-200 h-full">
      <div className="w-16 h-16 mb-4 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-700">{title}</h3>
      <p className="text-slate-600 max-w-xs leading-relaxed">{message}</p>
      <div className="mt-3 text-xs text-primary-500 font-medium">✨ Yeni veriler geldikçe burada görünecek!</div>
    </div>
  );
};

export default EmptyState;
