import React from 'react';
import { ResponsiveContainer } from 'recharts';

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


type ChartErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type ChartErrorBoundaryState = {
  hasError: boolean;
};

class ChartErrorBoundary extends React.Component<ChartErrorBoundaryProps, ChartErrorBoundaryState> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ChartErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    // Recharts can enter a subscription loop with React 19 in dev; keep the app usable without noisy console errors.
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ChartFallback />;
    }

    return this.props.children;
  }
}

const getChartFallbackHeight = (height: unknown) => {
  if (typeof height === 'number') return height;
  if (typeof height === 'string' && height.endsWith('px')) return Number.parseInt(height, 10) || 240;
  return 240;
};

type ChartDatum = Record<string, unknown>;

const labelKeyCandidates = new Set([
  'date',
  'label',
  'name',
  'courseName',
  'topic',
  'day',
  'window',
  'taskType',
  'month',
]);

const getElementName = (element: React.ReactElement) => {
  const type = element.type as { displayName?: string; name?: string } | string;
  return typeof type === 'string' ? type : type.displayName || type.name || '';
};

const collectChartElements = (node: React.ReactNode): React.ReactElement[] => {
  const elements: React.ReactElement[] = [];

  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    elements.push(child);
    const props = child.props as { children?: React.ReactNode };
    elements.push(...collectChartElements(props.children));
  });

  return elements;
};

const resolveChartData = (children: React.ReactNode): ChartDatum[] => {
  const elements = collectChartElements(children);
  for (const element of elements) {
    const data = (element.props as { data?: unknown }).data;
    if (Array.isArray(data) && data.length > 0) return data as ChartDatum[];
  }
  return [];
};

const resolveSeriesKeys = (data: ChartDatum[], children: React.ReactNode) => {
  const keys = new Set<string>();
  const elements = collectChartElements(children);

  elements.forEach((element) => {
    const dataKey = (element.props as { dataKey?: unknown }).dataKey;
    if (typeof dataKey === 'string' && data.some((item) => Number.isFinite(Number(item[dataKey])))) {
      keys.add(dataKey);
    }
  });

  if (keys.size === 0 && data[0]) {
    Object.keys(data[0]).forEach((key) => {
      if (!labelKeyCandidates.has(key) && data.some((item) => Number.isFinite(Number(item[key])))) {
        keys.add(key);
      }
    });
  }

  return Array.from(keys).slice(0, 3);
};

const resolveChartKind = (children: React.ReactNode) => {
  const names = collectChartElements(children).map(getElementName).join(' ');
  if (names.includes('Scatter')) return 'scatter';
  if (names.includes('Bar')) return 'bar';
  return 'line';
};

const resolveChartLayout = (children: React.ReactNode) => {
  const chartElement = collectChartElements(children).find((element) => getElementName(element).includes('BarChart'));
  const layout = chartElement ? (chartElement.props as { layout?: unknown }).layout : undefined;
  return layout === 'vertical' ? 'vertical' : 'horizontal';
};

const resolveLabelKey = (data: ChartDatum[], seriesKeys: string[]) => {
  const first = data[0] || {};
  return Object.keys(first).find((key) => !seriesKeys.includes(key) && labelKeyCandidates.has(key))
    || Object.keys(first).find((key) => !seriesKeys.includes(key) && typeof first[key] === 'string')
    || 'name';
};

const normalizeChartValue = (value: unknown, min: number, max: number, bottom: number, top: number) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return bottom;
  if (max <= min) return (top + bottom) / 2;
  return bottom - ((numberValue - min) / (max - min)) * (bottom - top);
};

const StaticChartFallback: React.FC<{ data: ChartDatum[]; height: number; children: React.ReactNode }> = ({ data, height, children }) => {
  const seriesKeys = React.useMemo(() => resolveSeriesKeys(data, children), [data, children]);
  const chartKind = React.useMemo(() => resolveChartKind(children), [children]);
  const chartLayout = React.useMemo(() => resolveChartLayout(children), [children]);
  const labelKey = React.useMemo(() => resolveLabelKey(data, seriesKeys), [data, seriesKeys]);
  const width = 640;
  const chartHeight = Math.max(160, height - 52);
  const padding = chartKind === 'bar' && chartLayout === 'vertical'
    ? { top: 18, right: 18, bottom: 24, left: 160 }
    : { top: 18, right: 18, bottom: 34, left: 38 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const values = data.flatMap((item) => seriesKeys.map((key) => Number(item[key])).filter(Number.isFinite));
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(10, ...values);
  const palette = chartSeries;
  const pointX = (index: number) => padding.left + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const pointY = (value: unknown) => normalizeChartValue(value, minValue, maxValue, padding.top + plotHeight, padding.top);
  const labelStep = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="ios-widget overflow-hidden rounded-[22px] p-3" style={{ minHeight: height }}>
      <svg className="h-full min-h-[180px] w-full" viewBox={'0 0 ' + width + ' ' + chartHeight} role="img" aria-label="Grafik verisi">
        <rect x="0" y="0" width={width} height={chartHeight} rx="18" fill="var(--dr-surface-strong)" stroke="var(--dr-border)" />
        {[0, 1, 2, 3].map((line) => {
          const y = padding.top + (plotHeight / 3) * line;
          return <line key={line} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(123,132,158,0.24)" strokeDasharray="4 8" />;
        })}

        {chartKind === 'bar' && chartLayout === 'vertical' && data.map((item, index) => {
          const rowHeight = plotHeight / Math.max(data.length, 1);
          const groupHeight = Math.max(5, (rowHeight * 0.62) / Math.max(seriesKeys.length, 1));
          const rowCenter = padding.top + (index * rowHeight) + (rowHeight / 2);
          const label = String(item[labelKey] || '').slice(0, 24);
          return (
            <g key={`row-${index}`}>
              <text x={padding.left - 10} y={rowCenter + 4} textAnchor="end" fontSize="11" fontWeight="700" fill={chartPalette.axis}>{label}</text>
              {seriesKeys.map((key, seriesIndex) => {
                const value = Number(item[key]);
                if (!Number.isFinite(value)) return null;
                const normalized = maxValue <= minValue ? 0.5 : (value - minValue) / (maxValue - minValue);
                const widthValue = Math.max(3, normalized * plotWidth);
                const y = padding.top + index * rowHeight + (rowHeight - groupHeight * seriesKeys.length) / 2 + seriesIndex * groupHeight;
                return <rect key={`${key}-${index}`} x={padding.left} y={y} width={widthValue} height={Math.max(3, groupHeight - 2)} rx="5" fill={palette[seriesIndex % palette.length]} />;
              })}
            </g>
          );
        })}

        {chartKind === 'bar' && chartLayout !== 'vertical' && seriesKeys.map((key, seriesIndex) => {
          const groupWidth = plotWidth / Math.max(data.length, 1);
          const barWidth = Math.max(5, (groupWidth * 0.68) / Math.max(seriesKeys.length, 1));
          return data.map((item, index) => {
            const value = Number(item[key]);
            if (!Number.isFinite(value)) return null;
            const x = padding.left + index * groupWidth + (groupWidth - (barWidth * seriesKeys.length)) / 2 + seriesIndex * barWidth;
            const y = pointY(value);
            const barHeight = padding.top + plotHeight - y;
            return <rect key={key + '-' + index} x={x} y={y} width={barWidth - 2} height={Math.max(2, barHeight)} rx="5" fill={palette[seriesIndex % palette.length]} />;
          });
        })}

        {chartKind === 'line' && seriesKeys.map((key, seriesIndex) => {
          const points = data
            .map((item, index) => ({ x: pointX(index), y: pointY(item[key]), value: Number(item[key]) }))
            .filter((point) => Number.isFinite(point.value));
          return (
            <g key={key}>
              <polyline points={points.map((point) => point.x + ',' + point.y).join(' ')} fill="none" stroke={palette[seriesIndex % palette.length]} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => <circle key={key + '-' + index} cx={point.x} cy={point.y} r="4" fill={palette[seriesIndex % palette.length]} stroke="#fff" strokeWidth="2" />)}
            </g>
          );
        })}

        {chartKind === 'scatter' && data.map((item, index) => {
          const xKey = seriesKeys[0] || 'duration';
          const yKey = seriesKeys[1] || 'accuracy';
          const xValues = data.map((entry) => Number(entry[xKey])).filter(Number.isFinite);
          const minX = Math.min(0, ...xValues);
          const maxX = Math.max(10, ...xValues);
          const xNumber = Number(item[xKey]);
          const yNumber = Number(item[yKey]);
          if (!Number.isFinite(xNumber) || !Number.isFinite(yNumber)) return null;
          const x = padding.left + ((xNumber - minX) / Math.max(1, maxX - minX)) * plotWidth;
          return <circle key={index} cx={x} cy={pointY(yNumber)} r="6" fill={palette[index % palette.length]} opacity="0.84" />;
        })}

        {!(chartKind === 'bar' && chartLayout === 'vertical') && data.filter((_, index) => index % labelStep === 0).slice(0, 6).map((item, index) => {
          const originalIndex = data.indexOf(item);
          const label = String(item[labelKey] || '').slice(0, 12);
          return <text key={label + '-' + index} x={pointX(originalIndex)} y={chartHeight - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill={chartPalette.axis}>{label}</text>;
        })}
      </svg>
    </div>
  );
};

const ChartFallback: React.FC<{ height?: number; children?: React.ReactNode }> = ({ height = 240, children }) => {
  const data = React.useMemo(() => resolveChartData(children), [children]);
  if (data.length > 0) return <StaticChartFallback data={data} height={height} children={children} />;

  return (
    <div className="ios-widget flex items-center justify-center rounded-[22px] px-4 text-center text-sm font-semibold text-slate-500" style={{ minHeight: height }}>
      Grafik şu anda gösterilemiyor; sayfa verileri ve özetler kullanılabilir.
    </div>
  );
};

type SafeResponsiveContainerProps = React.ComponentProps<typeof ResponsiveContainer> & {
  fallback?: React.ReactNode;
};

export const SafeResponsiveContainer: React.FC<SafeResponsiveContainerProps> = ({ children, fallback, debounce = 80, ...props }) => {
  const [mounted, setMounted] = React.useState(false);
  const fallbackHeight = getChartFallbackHeight(props.height);

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const isLocalhost = typeof window !== 'undefined' && window.location.hostname.match(/^(localhost|127\.0\.0\.1)$/);
  const shouldRenderRecharts = typeof window === 'undefined'
    || window.localStorage.getItem('drEnableRecharts') === 'true'
    || (!isLocalhost && window.localStorage.getItem('drDisableRecharts') !== 'true');

  if (!mounted || !shouldRenderRecharts) {
    return fallback || <ChartFallback height={fallbackHeight}>{children}</ChartFallback>;
  }

  return (
    <ChartErrorBoundary fallback={fallback || <ChartFallback height={fallbackHeight}>{children}</ChartFallback>}>
      <ResponsiveContainer debounce={debounce} {...props}>
        {children}
      </ResponsiveContainer>
    </ChartErrorBoundary>
  );
};
