import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { Mode, Portfolio } from '../data/types';
import { fmt, shortDate } from '../utils/format';
const grid = 'var(--border)';
const tooltipStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 14,
};
export interface Series {
  key: string;
  name: string;
  color: string;
}
export function TimeChart({
  data,
  series,
  kind = 'line',
  percent = false,
  height = 285,
  xKey = 'date',
}: {
  data: object[];
  series: Series[];
  kind?: 'line' | 'area' | 'bar';
  percent?: boolean;
  height?: number;
  xKey?: string;
}) {
  const common = { data, margin: { top: 15, right: 30, left: 0, bottom: 5 } },
    axis = { stroke: 'var(--muted)', fontSize: 14, tickLine: false, axisLine: false };
  const elements = (
    <>
      <CartesianGrid stroke={grid} strokeDasharray="3 5" vertical={false} />
      <XAxis
        dataKey={xKey}
        {...axis}
        minTickGap={60}
        tickFormatter={(v) => (xKey === 'date' ? shortDate(String(v)) : String(v))}
      />
      <YAxis
        {...axis}
        width={82}
        tickFormatter={(v) => `${fmt(Number(v), 0)}${percent ? '%' : ''}`}
      />
      <Tooltip
        contentStyle={tooltipStyle}
        labelFormatter={(v) => (xKey === 'date' ? String(v) : `Год ${v}`)}
        formatter={(v, name) => [`${fmt(Number(v), 2)}${percent ? '%' : ''}`, String(name)]}
      />
      <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 14, paddingTop: 14 }} />
      {percent && <ReferenceLine y={0} stroke={grid} />}
    </>
  );
  return (
    <div
      className="chart"
      style={{ height }}
      role="img"
      aria-label={series.map((s) => s.name).join(', ')}
    >
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'bar' ? (
          <BarChart {...common}>
            {elements}
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={34}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        ) : kind === 'area' ? (
          <AreaChart {...common}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.key} id={`fill-${s.key}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {elements}
            {series.map((s, i) => (
              <Area
                key={s.key}
                type="linear"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                fill={`url(#fill-${s.key}-${i})`}
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart {...common}>
            {elements}
            {series.map((s) => (
              <Line
                key={s.key}
                type="linear"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
export function FrontierChart({
  points,
  selected,
  min,
  max,
  onSelect,
}: {
  points: Portfolio[];
  selected: Portfolio;
  min: Portfolio;
  max: Portfolio;
  onSelect: (w: number) => void;
}) {
  const adapt = (p: Portfolio) => ({
    ...p,
    x: p.risk * 100,
    y: p.mean * 100,
    label: `SBER ${fmt(p.weight * 100, 0)}% / T ${fmt((1 - p.weight) * 100, 0)}%`,
  });
  const marker = (props: unknown, weight: number, label: string, shape: 'star' | 'diamond') => {
    const point = props as { cx?: number; cy?: number };
    if (point.cx === undefined || point.cy === undefined) return <g />;
    const select = () => onSelect(weight);
    return (
      <g
        role="button"
        aria-label={label}
        tabIndex={0}
        transform={`translate(${point.cx},${point.cy})`}
        style={{ cursor: 'pointer' }}
        onPointerDown={(event) => {
          event.stopPropagation();
          select();
        }}
        onClick={(event) => {
          event.stopPropagation();
          select();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            select();
          }
        }}
      >
        <circle r={10} fill="transparent" />
        {shape === 'star' ? (
          <polygon
            points="0,-8 2,-2.5 8,-2.5 3,1 5,7 0,3.5 -5,7 -3,1 -8,-2.5 -2,-2.5"
            fill="#f3c978"
          />
        ) : (
          <polygon points="0,-6 5,0 0,6 -5,0" fill="#40cbb0" />
        )}
      </g>
    );
  };
  return (
    <div className="chart frontier-chart" role="img" aria-label="Эффективная граница Марковица">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 20, right: 25, left: 5, bottom: 25 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 5" />
          <XAxis
            type="number"
            dataKey="x"
            name="Годовой риск"
            domain={['auto', 'auto']}
            tick={{ fill: 'var(--muted)', fontSize: 14 }}
            tickFormatter={(v) => `${fmt(Number(v), 0)}%`}
            label={{
              value: 'Годовая волатильность, %',
              position: 'bottom',
              fill: 'var(--muted)',
              fontSize: 14,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Годовая доходность"
            domain={['auto', 'auto']}
            tick={{ fill: 'var(--muted)', fontSize: 14 }}
            tickFormatter={(v) => `${fmt(Number(v), 0)}%`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as ReturnType<typeof adapt> | undefined;
              return active && p ? (
                <div className="chart-tooltip">
                  <strong>{p.label}</strong>
                  <p>Доходность: {fmt(p.y)}%</p>
                  <p>Риск: {fmt(p.x)}%</p>
                  <p>Sharpe: {fmt(p.sharpe, 2)}</p>
                </div>
              ) : null;
            }}
          />
          <Line
            data={points.map(adapt)}
            dataKey="y"
            stroke="#4d5e76"
            strokeWidth={2}
            dot={false}
            legendType="none"
            isAnimationActive={false}
          />
          <Line
            data={points.filter((p) => p.efficient).map(adapt)}
            dataKey="y"
            stroke="#40cbb0"
            strokeWidth={3}
            dot={false}
            legendType="none"
            isAnimationActive={false}
          />
          <Scatter
            activeShape={false}
            name="Все портфели"
            data={points.map(adapt)}
            fill="transparent"
            shape={(props: unknown) => {
              const p = props as {
                cx?: number;
                cy?: number;
                weight?: number;
                payload?: { weight?: number };
              };
              const weight = p.weight ?? p.payload?.weight;
              return (
                <circle
                  cx={p.cx}
                  cy={p.cy}
                  r={3.5}
                  fill="transparent"
                  data-weight={weight}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    if (weight !== undefined) onSelect(weight);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (weight !== undefined) onSelect(weight);
                  }}
                />
              );
            }}
            onClick={(entry) => {
              const e = entry as unknown as { weight?: number; payload?: { weight?: number } };
              const weight = e.weight ?? e.payload?.weight;
              if (weight !== undefined) onSelect(weight);
            }}
            isAnimationActive={false}
          />
          <Scatter
            activeShape={false}
            name="Минимальный риск"
            data={[adapt(min)]}
            fill="#40cbb0"
            shape={(props) => marker(props, min.weight, 'На графике: минимальный риск', 'diamond')}
            onClick={() => onSelect(min.weight)}
            isAnimationActive={false}
          />
          <Scatter
            activeShape={false}
            name="Максимум Sharpe"
            data={[adapt(max)]}
            fill="#f3c978"
            shape={(props) => marker(props, max.weight, 'На графике: максимум Sharpe', 'star')}
            onClick={() => onSelect(max.weight)}
            isAnimationActive={false}
          />
          <Scatter
            activeShape={false}
            name="Выбранный портфель"
            data={[adapt(selected)]}
            fill="#78a0ff"
            stroke="#c5d5ff"
            strokeWidth={2}
            isAnimationActive={false}
          />
          <ZAxis range={[65, 65]} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="chart-legend">
        <span>
          <i style={{ background: '#40cbb0' }} />
          Эффективная граница
        </span>
        <span>
          <i style={{ background: '#f3c978' }} />
          Максимум Sharpe
        </span>
        <span>
          <i style={{ background: '#78a0ff' }} />
          Ваш портфель
        </span>
      </div>
    </div>
  );
}
export function RiskScatter({
  data,
}: {
  data: { x: number; y: number; name: string; color: string }[];
}) {
  return (
    <div style={{ height: 270 }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 15, right: 35, left: 10, bottom: 25 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 5" />
          <XAxis
            type="number"
            dataKey="x"
            name="Риск"
            unit="%"
            tick={{ fill: 'var(--muted)', fontSize: 14 }}
            label={{
              value: 'Годовая волатильность, %',
              position: 'bottom',
              fill: 'var(--muted)',
              fontSize: 14,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Доходность"
            unit="%"
            tick={{ fill: 'var(--muted)', fontSize: 14 }}
          />
          <Tooltip contentStyle={tooltipStyle} />
          {data.map((p) => (
            <Scatter
              activeShape={false}
              key={p.name}
              name={p.name}
              data={[p]}
              fill={p.color}
              isAnimationActive={false}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
export function companySeries(mode: Mode): Series[] {
  return (mode === 'compare' ? ['SBER', 'T'] : [mode]).map((key) => ({
    key,
    name: key === 'SBER' ? 'Сбербанк' : 'Т-Технологии',
    color: key === 'SBER' ? '#40cbb0' : '#78a0ff',
  }));
}
