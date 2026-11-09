import { useState } from 'react';
import type { Company, Mode } from '../data/types';
import type { DataSet } from '../services/data';
import type { AnalysisModel } from '../services/model';
import { companies } from '../data/types';
import { Card, Disclosure, Hint, KPI, Notice, SectionIntro } from '../components/ui';
import { TimeChart, RiskScatter, companySeries } from '../charts/Charts';
import { drawdowns, stdev } from '../calculations/statistics';
import { metricExplanation } from '../data/metric-help';
import { fmt, pct } from '../utils/format';
export function Risk({ data, model, mode }: { data: DataSet; model: AnalysisModel; mode: Mode }) {
  const [chartView, setChartView] = useState<'returns' | 'drawdown'>('drawdown');
  const cs: Company[] = mode === 'compare' ? ['SBER', 'T'] : [mode];
  const c = cs[0],
    s = model.stats[c];
  const maps = Object.fromEntries(
    (['SBER', 'T'] as Company[]).map((c) => [
      c,
      new Map(model.wealth[c].map((q) => [q.date, q.value])),
    ]),
  ) as Record<Company, Map<string, number | null>>;
  const dates = [
    ...new Set(model.wealth.SBER.map((q) => q.date).concat(model.wealth.T.map((q) => q.date))),
  ].sort();
  const wealth = dates.map((date) => ({
    date,
    ...Object.fromEntries(
      cs.map((c) => [
        c,
        maps[c].get(date) === null || maps[c].get(date) === undefined
          ? null
          : maps[c].get(date)! * 100,
      ]),
    ),
  }));
  const dds: Record<Company, Map<string, number>> = { SBER: new Map(), T: new Map() };
  for (const c of cs) {
    const valid = model.wealth[c].filter(
        (q): q is { date: string; value: number } => q.value !== null,
      ),
      dd = drawdowns(valid.map((q) => q.value));
    dds[c] = new Map(valid.map((q, i) => [q.date, dd[i] * 100]));
  }
  const dd = dates.map((date) => ({
    date,
    ...Object.fromEntries(cs.map((c) => [c, dds[c].get(date) ?? null])),
  }));
  const monthly = model.rows.map((r, i) => ({
    date: r.date,
    ...Object.fromEntries(cs.map((c) => [c, r[c] === null ? null : r[c]! * 100])),
    ...Object.fromEntries(
      cs.map((c) => {
        const win = model.rows.slice(Math.max(0, i - 11), i + 1).map((r) => r[c]);
        return [
          `vol${c}`,
          win.length === 12 && win.every((v): v is number => v !== null)
            ? stdev(win) * Math.sqrt(12) * 100
            : null,
        ];
      }),
    ),
  }));
  const prices = data.market.monthly
    .filter((q) => q.date >= dates[0])
    .map((q) => ({ date: q.date, SBER: q.SBER, T: q.T }));
  return (
    <>
      <SectionIntro
        title="Доходность и риск"
        description="Историческая доходность и размер возможных колебаний."
      />
      <div className="kpi-grid">
        <KPI
          label={`CAGR · ${c}`}
          hint={metricExplanation('cagr')}
          value={pct(s?.cagr)}
          detail="Геометрическая доходность стоимости"
        />
        <KPI
          label="Годовая волатильность"
          value={pct(s?.annualVol)}
          detail="Выборочная σ месяца × √12"
          color="gold"
        />
        <KPI
          label="Коэффициент Шарпа"
          value={fmt(s?.sharpe, 2)}
          detail="На общей месячной выборке"
          hint={metricExplanation('sharpe')}
        />
        <KPI
          label="Максимальная просадка"
          value={pct(s?.maxDrawdown)}
          detail="По дневным закрытиям выбранного ряда"
          color="red"
        />
      </div>
      <div className="grid-two">
        <Card
          title="Накопленная стоимость"
          subtitle="Начальная стоимость = 100 · дивиденды зависят от режима"
        >
          <TimeChart data={wealth} series={companySeries(mode)} kind="area" />
        </Card>
        <Card
          title={chartView === 'drawdown' ? 'Просадка' : 'Месячная доходность'}
          action={
            <div className="segmented small" aria-label="Вид графика риска">
              <button
                className={chartView === 'returns' ? 'active' : ''}
                onClick={() => setChartView('returns')}
              >
                Доходность
              </button>
              <button
                className={chartView === 'drawdown' ? 'active' : ''}
                onClick={() => setChartView('drawdown')}
              >
                Просадка
              </button>
            </div>
          }
        >
          <TimeChart
            data={chartView === 'drawdown' ? dd : monthly}
            series={companySeries(mode)}
            kind={chartView === 'drawdown' ? 'area' : 'bar'}
            percent
          />
        </Card>
      </div>
      <Disclosure title="Подробнее">
        <div className="grid-two">
          <Card
            title="Скользящая волатильность"
            subtitle="Годовая σ по 12 последовательным месячным наблюдениям"
          >
            <TimeChart
              data={monthly}
              series={companySeries(mode).map((s) => ({ ...s, key: `vol${s.key}` }))}
              percent
            />
          </Card>
          <Card
            title="Цена акций на общей шкале"
            subtitle="Рубли · T приведена к сплиту 1:10; общие даты конца месяца"
          >
            <TimeChart data={prices} series={companySeries(mode)} />
          </Card>
          <Card
            title="Баланс риска и доходности"
            subtitle="Годовая арифметическая доходность против годовой волатильности"
          >
            <RiskScatter
              data={cs.flatMap((c) => {
                const s = model.stats[c];
                return s
                  ? [
                      {
                        x: s.annualVol * 100,
                        y: s.annualMean * 100,
                        name: companies[c].name,
                        color: companies[c].color,
                      },
                    ]
                  : [];
              })}
            />
          </Card>
        </div>
        <Card
          title="Сравнение инвестиционных характеристик"
          subtitle={`Корреляция на общей выборке: ${fmt(model.correlation, 3)} · ${model.pair.rows.length} пар`}
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Метрика</th>
                  {cs.map((c) => (
                    <th key={c}>{companies[c].name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    'Средняя месячная',
                    'monthlyMean',
                    'Среднее арифметическое месячных доходностей.',
                  ],
                  ['Средняя годовая', 'annualMean', '12 × средняя месячная. Не равна CAGR.'],
                  [
                    'CAGR стоимости',
                    'cagr',
                    '(Конечная стоимость / начальная)^(365,25 / дни) − 1. При пропусках не вычисляется произведением неполной месячной выборки.',
                  ],
                  ['Месячная σ', 'monthlyVol', '√[Σ(R − среднее)² / (n − 1)].'],
                  [
                    'Годовая σ',
                    'annualVol',
                    'σ месяца × √12. Предполагает отсутствие серийной корреляции.',
                  ],
                  [
                    'Коэффициент Шарпа',
                    'sharpe',
                    '(среднее месяца − ((1 + Rf год)^(1/12) − 1)) / σ месяца × √12.',
                  ],
                  [
                    'Max Drawdown',
                    'maxDrawdown',
                    'Минимум (стоимость / предыдущий максимум − 1) по дневным закрытиям.',
                  ],
                  [
                    'VaR 95%, один месяц',
                    'var95',
                    'Исторический метод: отрицательный 5%-квантиль (линейная интерполяция), минимум 24 наблюдения. VaR не ограничивает возможные потери.',
                  ],
                ].map(([label, key, hint]) => (
                  <tr key={key}>
                    <th>
                      <span className="metric-label">
                        {label}
                        <Hint text={hint} />
                      </span>
                    </th>
                    {cs.map((c) => (
                      <td key={c}>
                        {key === 'sharpe'
                          ? fmt(model.stats[c]?.sharpe, 2)
                          : pct(model.stats[c]?.[key as 'annualMean'])}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th>Месяцев в выборке</th>
                  {cs.map((c) => (
                    <td key={c}>{model.stats[c]?.n ?? 0}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
        <Notice>
          Для месячной статистики акций, корреляции и портфеля используются только синхронные
          месяцы. CAGR и дневная просадка используют доступную непрерывную историю каждого актива
          между его началом и концом; торговые паузы не означают нулевую доходность. Дневные
          закрытия могут недооценивать внутридневную просадку.
        </Notice>
      </Disclosure>
    </>
  );
}
