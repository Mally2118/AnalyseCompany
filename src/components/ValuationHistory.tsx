import { MetricHelp } from './MetricHelp';
import type { Company, Mode } from '../data/types';
import { companies, years } from '../data/types';
import type { DataSet } from '../services/data';
import { historicalValuations } from '../calculations/valuation';
import { Card } from './ui';
import { TimeChart, companySeries } from '../charts/Charts';
import { date, fmt } from '../utils/format';
export function ValuationHistory({ data, mode }: { data: DataSet; mode: Mode }) {
  const cs: Company[] = mode === 'compare' ? ['SBER', 'T'] : [mode],
    values = historicalValuations(data.financial, data.market).filter((v) =>
      cs.includes(v.company),
    );
  const chart = years.map((year) => ({
    year,
    ...Object.fromEntries(
      cs.map((c) => [c, values.find((v) => v.year === year && v.company === c)?.pe ?? null]),
    ),
  }));
  return (
    <Card
      title="Исторический P/E"
      subtitle="Цена последнего торгового дня года / базовая годовая EPS · ретроспективная оценка"
    >
      <TimeChart data={chart} series={companySeries(mode)} xKey="year" />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Акция / год</th>
              <th>Дата цены</th>
              <th>Цена, ₽</th>
              <th>
                EPS, ₽ <MetricHelp metric="eps" />
              </th>
              <th>
                P/E <MetricHelp metric="pe" />
              </th>
              <th>Исходные данные</th>
            </tr>
          </thead>
          <tbody>
            {values.map((v) => (
              <tr key={v.company + v.year}>
                <th>
                  {companies[v.company].name} · {v.year}
                </th>
                <td>{v.priceDate ? date(v.priceDate) : 'Нет данных'}</td>
                <td>{fmt(v.price, 2)}</td>
                <td>{fmt(v.eps, 3)}</td>
                <td>{v.pe === null ? v.status : `${fmt(v.pe, 2)} ×`}</td>
                <td>
                  {v.eps === null ? (
                    'EPS не подтверждена'
                  ) : (
                    <a href={v.epsUrl} target="_blank" rel="noreferrer">
                      Базовая EPS
                    </a>
                  )}{' '}
                  ·{' '}
                  <a href={v.priceUrl} target="_blank" rel="noreferrer">
                    Котировка MOEX
                  </a>
                  <small>{v.basis}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="footnote">
        Годовая EPS опубликована позже даты цены: все значения ретроспективные. Для T цена и EPS в
        единой базе сплита 1:10; допэмиссии отражаются в опубликованной средневзвешенной базовой
        EPS. Операционная EPS не подставляется. При отсутствующей или неположительной EPS P/E не
        вычисляется; низкий мультипликатор не доказывает недооценку.
      </p>
    </Card>
  );
}
