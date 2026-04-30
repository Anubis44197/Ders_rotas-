import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import EmptyState from '../shared/EmptyState';
import { Info } from '../icons';
import { ChartTooltip, chartAxisProps, chartBrushProps, chartGridProps, chartLegendProps, chartPalette } from '../shared/chartDesign';

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
    return <EmptyState icon={<Info className="h-6 w-6" />} title={`${courseName} icin trend verisi yok`} message="Secilen tarih araliginda yeterli tamamlanan gorev olusunca trend grafigi burada gosterilecek." />;
  }

  const latest = data[data.length - 1];

  return (
    <div className="ios-card mb-6 rounded-[28px] p-6">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-900">{courseName} performans trendi</h4>
          <p className="text-sm text-slate-500">Basari ve odak puaninin zaman icindeki degisimi.</p>
        </div>
        <div className="ios-widget rounded-2xl px-4 py-3 text-sm text-slate-600">
          Son olcum: <strong>{latest?.period}</strong>
          <span className="ml-2 text-slate-400">Basari {latest?.successScore ?? '-'} / Odak {latest?.focusScore ?? '-'}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey="period" {...chartAxisProps} />
          <YAxis domain={[0, 100]} {...chartAxisProps} />
          <Tooltip content={<ChartTooltip valueFormatter={(value) => `${value} puan`} />} />
          <Legend {...chartLegendProps} />
          <Line type="monotone" dataKey="successScore" name="Basari skoru" stroke={chartPalette.blue} strokeWidth={3} dot={{ r: 4, fill: chartPalette.blue, strokeWidth: 0 }} activeDot={{ r: 7 }} />
          <Line type="monotone" dataKey="focusScore" name="Odak skoru" stroke={chartPalette.mint} strokeWidth={3} dot={{ r: 4, fill: chartPalette.mint, strokeWidth: 0 }} activeDot={{ r: 7 }} />
          {data.length > 5 && <Brush dataKey="period" {...chartBrushProps} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CoursePerformanceTrendChart;
