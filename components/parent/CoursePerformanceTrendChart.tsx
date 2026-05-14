import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Brush } from 'recharts';
import EmptyState from '../shared/EmptyState';
import { Info } from '../icons';
import { ChartTooltip, chartAxisProps, chartBrushProps, chartGridProps, chartPalette, SafeResponsiveContainer } from '../shared/chartDesign';

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
    return <EmptyState icon={<Info className="h-6 w-6" />} title={`${courseName} için trend verisi yok`} message="Seçilen tarih aralığında yeterli tamamlanan görev oluşunca trend grafiği burada gösterilecek." />;
  }

  const latest = data[data.length - 1];

  return (
    <div className="ios-card mb-6 rounded-[28px] p-6">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-900">{courseName} performans trendi</h4>
          <p className="text-sm text-slate-500">Başarı ve odak puanının zaman içindeki değişimi.</p>
        </div>
        <div className="ios-widget rounded-2xl px-4 py-3 text-sm text-slate-600">
          Son ölçüm: <strong>{latest?.period}</strong>
          <span className="ml-2 text-slate-400">Başarı {latest?.successScore ?? '-'} / Odak {latest?.focusScore ?? '-'}</span>
        </div>
      </div>

      <SafeResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey="period" {...chartAxisProps} />
          <YAxis domain={[0, 100]} {...chartAxisProps} />
          <Tooltip content={<ChartTooltip valueFormatter={(value) => `${value} puan`} />} />
          <Line legendType="none" type="monotone" dataKey="successScore" name="Başarı skoru" stroke={chartPalette.blue} strokeWidth={3} dot={{ r: 4, fill: chartPalette.blue, strokeWidth: 0 }} activeDot={{ r: 7 }} />
          <Line legendType="none" type="monotone" dataKey="focusScore" name="Odak skoru" stroke={chartPalette.mint} strokeWidth={3} dot={{ r: 4, fill: chartPalette.mint, strokeWidth: 0 }} activeDot={{ r: 7 }} />
          {data.length > 5 && <Brush dataKey="period" {...chartBrushProps} />}
        </LineChart>
      </SafeResponsiveContainer>
    </div>
  );
};

export default CoursePerformanceTrendChart;
