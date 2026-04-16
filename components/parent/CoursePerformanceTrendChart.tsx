import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import EmptyState from '../shared/EmptyState';

interface Props {
  data: Array<{
    period: string;
    successScore: number | null;
    focusScore: number | null;
    courseName: string;
  }>;
  courseName: string;
}

const CoursePerformanceTrendChart: React.FC<Props> = ({ data, courseName }) => {
  if (!data.length) {
    return <EmptyState icon={<div className="text-xl text-slate-400">i</div>} title={`${courseName} icin trend verisi yok`} message="Secilen tarih araliginda yeterli tamamlanan gorev olusunca trend grafigi burada gosterilecek." />;
  }

  return (
    <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-900">{courseName} performans trendi</h4>
          <p className="text-sm text-slate-500">Basari ve odak puaninin zaman icindeki degisimi.</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Son olcum: <strong>{data[data.length - 1]?.period}</strong>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" fontSize={12} />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="successScore" name="Basari skoru" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="focusScore" name="Odak skoru" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
          {data.length > 5 && <Brush dataKey="period" height={28} stroke="#94a3b8" fill="#f8fafc" />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CoursePerformanceTrendChart;
