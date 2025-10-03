import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';

interface Props {
  data: Array<{
    period: string;
    successScore: number | null;
    focusScore: number | null;
    courseName: string;
  }>;
  courseName: string;
}

const CoursePerformanceTrendChart: React.FC<Props> = ({ data, courseName }) => (
  <div className="bg-white p-6 rounded-xl shadow-md mb-6">
    <h4 className="font-bold text-lg mb-2">{courseName} Dersi Performans Gelişimi</h4>
    <div className="text-xs text-slate-500 mb-4">📊 Grafik üzerinde kaydırarak yakınlaştırma yapabilirsiniz</div>
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" fontSize={12} />
        <YAxis domain={[0, 100]} unit="%" />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="successScore" name="Başarı Puanı" stroke="#3b82f6" strokeWidth={2} />
        <Line type="monotone" dataKey="focusScore" name="Odak Puanı" stroke="#f59e42" strokeWidth={2} />
        {data.length > 5 && (
          <Brush 
            dataKey="period" 
            height={30} 
            stroke="#8884d8"
            fill="#f1f5f9"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export default CoursePerformanceTrendChart;
