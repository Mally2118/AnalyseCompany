import { useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DataSet } from '../services/data';
import type { AnalysisModel } from '../services/model';
import type { Mode, ReturnKind } from '../data/types';
import type { RecoveryData } from '../services/recovery';
import { researchMarket, recoveryMethodNames } from '../calculations/recovery';
import { wealthSeries } from '../calculations/market';
import { date, fmt, rub, shortDate } from '../utils/format';
interface Row {
  date: string;
  SBER: number | null;
  T: number | null;
  estimated: number | null;
  price: number | null;
  isEstimated: boolean;
  method: string;
}
export function RecoveryChart({
  data,
  model,
  recovery,
  kind,
  mode,
}: {
  data: DataSet;
  model: AnalysisModel;
  recovery: RecoveryData;
  kind: ReturnKind;
  mode: Mode;
}) {
  const [focus, setFocus] = useState(true);
  const restored = new Map(
    wealthSeries(researchMarket(data.market, recovery), 'T', kind, model.period).map((q) => [
      q.date,
      q.value,
    ]),
  );
  const actual = {
    SBER: new Map(model.wealth.SBER.map((q) => [q.date, q.value])),
    T: new Map(model.wealth.T.map((q) => [q.date, q.value])),
  };
  const visible = recovery.observations.filter(
    (q) =>
      q.date >= model.period.from &&
      q.date <= model.period.till &&
      (!focus || (q.date >= '2024-02-01' && q.date <= '2024-03-29')),
  );
  const rows: Row[] = visible.map((q, i) => ({
    date: q.date,
    SBER: actual.SBER.get(q.date) == null ? null : actual.SBER.get(q.date)! * 100,
    T: actual.T.get(q.date) == null ? null : actual.T.get(q.date)! * 100,
    estimated:
      q.estimatedPrice !== null ||
      visible[i - 1]?.estimatedPrice != null ||
      visible[i + 1]?.estimatedPrice != null
        ? restored.get(q.date) == null
          ? null
          : restored.get(q.date)! * 100
        : null,
    price: q.actualPrice ?? q.estimatedPrice,
    isEstimated: q.estimatedPrice !== null,
    method: q.method,
  }));
  return (
    <>
      <label className="recovery-zoom">
        <input type="checkbox" checked={focus} onChange={(e) => setFocus(e.target.checked)} />
        Участок 01.02–29.03.2024 (масштаб графика)
      </label>
      <div
        className="chart recovery-chart"
        style={{ height: 285 }}
        role="img"
        aria-label="Фактическая стоимость и условное восстановление Т-Технологий"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 15, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--muted)', fontSize: 14 }}
              tickLine={false}
              axisLine={false}
              minTickGap={60}
              tickFormatter={(v) =>
                focus
                  ? new Date(String(v)).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: 'short',
                      timeZone: 'UTC',
                    })
                  : shortDate(String(v))
              }
            />
            <YAxis
              domain={['auto', 'auto']}
              width={65}
              tick={{ fill: 'var(--muted)', fontSize: 14 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as Row | undefined;
                if (!active || !row) return null;
                return (
                  <div className="recovery-tooltip">
                    <strong>{date(row.date)}</strong>
                    <p>T: {rub(row.price, 2)}</p>
                    <p>
                      {row.isEstimated
                        ? 'Условная оценка, нет торгов TQBR'
                        : row.price === null
                          ? 'Нет торговой котировки T'
                          : 'Фактическая котировка TQBR'}
                    </p>
                    {row.isEstimated && <p>Метод: {recoveryMethodNames[row.method]}</p>}
                    <p>Стоимость инвестиции T: {fmt(row.estimated ?? row.T, 2)} / 100</p>
                  </div>
                );
              }}
            />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 14, paddingTop: 14 }} />
            {mode !== 'T' && (
              <Line
                dataKey="SBER"
                name="Сбербанк · факт"
                stroke="var(--mint)"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
                strokeWidth={2}
              />
            )}
            {mode !== 'SBER' && (
              <Line
                dataKey="T"
                name="Т-Технологии · факт"
                stroke="var(--blue)"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
                strokeWidth={2}
              />
            )}
            <Line
              dataKey="estimated"
              name="T · условная оценка"
              stroke="var(--recovery-line)"
              strokeDasharray="7 5"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
