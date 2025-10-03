import React, { useMemo } from 'react';
import { Task } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Brush } from 'recharts';
import { Zap, Loader } from '../icons';
import EmptyState from '../shared/EmptyState';

interface CompletionSpeedAnalysisProps {
  tasks: Task[];
  loading?: boolean;
  error?: string | null;
}

// Loading Spinner Component
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center h-48">
    <Loader className="w-8 h-8 animate-spin text-primary-600" />
    <span className="ml-2 text-slate-600">Veriler yükleniyor...</span>
  </div>
);

// Error State Component
const ErrorState: React.FC<{ error: string }> = ({ error }) => (
  <div className="flex flex-col items-center justify-center h-48 text-center">
    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
      <span className="text-red-500 text-xl">⚠️</span>
    </div>
    <p className="text-slate-600 mb-2">Veriler yüklenirken bir sorun oluştu</p>
    <p className="text-sm text-slate-500">{error}</p>
  </div>
);

const CompletionSpeedAnalysis: React.FC<CompletionSpeedAnalysisProps> = ({ tasks, loading = false, error = null }) => {
  // Sadece tamamlanmış ve planlanan/gerçek süreleri olan görevler
  const completed = useMemo(() => tasks.filter(t => t.status === 'tamamlandı' && typeof t.plannedDuration === 'number' && typeof t.actualDuration === 'number'), [tasks]);

  // Planlanan ve gerçek sürelerin karşılaştırılması (dk cinsinden)
  const data = useMemo(() => {
    // Son 20 görevi göster (en güncelden eskiye)
    return completed.slice(-20).map(t => ({
      title: t.title.length > 18 ? t.title.slice(0, 15) + '...' : t.title,
      'Planlanan Süre': t.plannedDuration,
      'Gerçek Süre': Math.round((t.actualDuration || 0) / 60),
    }));
  }, [completed]);

  if (completed.length === 0) {
    return <EmptyState icon={<Zap className="w-8 h-8 text-slate-400" />} title="Tamamlanma Hızı Analizi İçin Veri Yok" message="Çocuğunuz görevleri tamamladıkça, planlanan ve gerçek süre karşılaştırması burada görünecek." />;
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <h3 className="text-xl font-bold mb-4 flex items-center"><Zap className="w-6 h-6 mr-2 text-primary-600" />Tamamlanma Hızı Analizi</h3>
      <div className="text-xs text-slate-500 mb-4">📊 Fazla veri varsa grafik üzerinde kaydırarak detaya bakabilirsiniz</div>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: data.length > 8 ? 75 : 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="title" fontSize={12} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis label={{ value: 'dk', angle: -90, position: 'insideLeft', offset: 10 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Planlanan Süre" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Gerçek Süre" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          {data.length > 8 && (
            <Brush 
              dataKey="title" 
              height={30} 
              stroke="#8884d8"
              fill="#f1f5f9"
            />
          )}
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-500 mt-2">Son 20 tamamlanmış görev için planlanan ve gerçek süre karşılaştırması.</p>
    </div>
  );
};

export default CompletionSpeedAnalysis;
