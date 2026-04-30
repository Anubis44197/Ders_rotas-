import React from 'react';

export const chartPalette = {
  blue: '#8AB4FF',
  mint: '#7EE7C7',
  lilac: '#C4B5FD',
  peach: '#FFC68B',
  coral: '#FF9AA2',
  yellow: '#FFE08A',
  ink: '#F1F5FF',
  grid: 'rgba(46, 54, 80, 0.78)',
  axis: '#7B849E',
  tooltipBorder: 'rgba(138, 180, 255, 0.24)',
  tooltipBg: 'rgba(255, 255, 255, 0.94)',
  darkTooltipBg: 'rgba(15, 19, 32, 0.94)',
};

export const chartSeries = [
  chartPalette.blue,
  chartPalette.mint,
  chartPalette.lilac,
  chartPalette.peach,
  chartPalette.coral,
  chartPalette.yellow,
];

export const chartAxisProps = {
  tickLine: false,
  axisLine: false,
  tickMargin: 10,
  minTickGap: 18,
  tick: { fill: chartPalette.axis, fontSize: 12, fontWeight: 600 },
};

export const chartGridProps = {
  stroke: chartPalette.grid,
  strokeDasharray: '2 10',
  vertical: false,
};

export const chartLegendProps = {
  iconType: 'circle' as const,
  wrapperStyle: {
    color: chartPalette.ink,
    fontSize: 12,
    fontWeight: 600,
    paddingTop: 8,
  },
};

export const chartBrushProps = {
  height: 28,
  stroke: chartPalette.blue,
  fill: 'rgba(138, 180, 255, 0.10)',
};

export const chartLineProps = {
  type: 'monotone' as const,
  strokeWidth: 4,
  activeDot: { r: 7, strokeWidth: 3, stroke: '#ffffff' },
};

export const chartPointProps = {
  r: 4,
  strokeWidth: 2,
  stroke: '#ffffff',
};

export const chartBarRadius: [number, number, number, number] = [12, 12, 0, 0];

type TooltipPayload = {
  color?: string;
  dataKey?: string;
  name?: string;
  value?: number | string;
  payload?: Record<string, unknown>;
};

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: TooltipPayload[];
  valueFormatter?: (value: number | string, name: string, item: TooltipPayload) => string;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, label, payload, valueFormatter }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="dr-chart-tooltip">
      {label && <div className="dr-chart-tooltip-label">{label}</div>}
      <div className="space-y-2">
        {payload.map((item) => {
          const name = String(item.name || item.dataKey || '');
          const value = item.value ?? '';
          return (
            <div key={`${name}-${value}`} className="dr-chart-tooltip-row">
              <span className="dr-chart-tooltip-mark" style={{ color: item.color || chartPalette.blue }} aria-hidden="true" />
              <span className="dr-chart-tooltip-name">{name}</span>
              <strong>{valueFormatter ? valueFormatter(value, name, item) : value}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ChartAccessibilitySummaryProps {
  title: string;
  summary: string;
}

export const ChartAccessibilitySummary: React.FC<ChartAccessibilitySummaryProps> = ({ title, summary }) => (
  <p className="sr-only">{title}. {summary}</p>
);
