import { IndicatorSummary } from '../components/IndicatorSummary';
import { MetricHelp } from '../components/MetricHelp';
import type { Mode, Company } from '../data/types';
import { companies } from '../data/types';
import type { DataSet } from '../services/data';
import type { AnalysisModel } from '../services/model';
import { Card, Disclosure, KPI, SectionIntro } from '../components/ui';
import { TimeChart, companySeries } from '../charts/Charts';
import { fact, marketRisk, stability } from '../calculations/analysis';
import { metricExplanation } from '../data/metric-help';
import { fmt, pct, date } from '../utils/format';
export function Overview({
  data,
  model,
  mode,
  navigate,
}: {
  data: DataSet;
  model: AnalysisModel;
  mode: Mode;
  navigate: (page: string) => void;
}) {
  const cs: Company[] = mode === 'compare' ? ['SBER', 'T'] : [mode],
    c = cs[0],
    stat = model.stats[c];
  const other = mode === 'compare' ? 'T' : null;
  const tValues = new Map(model.wealth.T.map((q) => [q.date, q.value]));
  const wealth = model.wealth.SBER.filter((_, i, rows) => i % 5 === 0 || i === rows.length - 1).map(
    (q) => ({
      date: q.date,
      SBER: q.value === null ? null : q.value * 100,
      T: tValues.get(q.date) == null ? null : tValues.get(q.date)! * 100,
    }),
  );
  return (
    <>
      <SectionIntro
        title="Обзор"
        description="Финансовое состояние, доходность и риск выбранных акций."
      />
      <div className="kpi-grid three">
        <KPI
          label={`Чистая прибыль · ${c}`}
          value={`${fmt(fact(data.financial, c, 2025, 'profit'))} млрд ₽`}
          detail="2025 · консолидированная МСФО"
        >
          {other && <small>Т: {fmt(fact(data.financial, other, 2025, 'profit'))} млрд ₽</small>}
        </KPI>
        <KPI
          label="Среднегодовая доходность (CAGR)"
          value={pct(stat?.cagr, 2)}
          detail={`${c} · ${date(model.period.from)} — ${date(model.period.till)}`}
          hint={metricExplanation('cagr')}
        >
          {other && <small>Т: {pct(model.stats.T?.cagr, 2)}</small>}
        </KPI>
        <KPI
          label="Годовой риск"
          value={pct(stat?.annualVol, 2)}
          detail={`${c} · волатильность · ${marketRisk(stat).toLowerCase()}`}
          hint={metricExplanation('volatility')}
        >
          {other && (
            <small>
              Т: {pct(model.stats.T?.annualVol, 2)} · {marketRisk(model.stats.T).toLowerCase()}
            </small>
          )}
        </KPI>
      </div>
      <div className="dashboard-main">
        <Card
          title="Стоимость инвестиции"
          subtitle="Начальная стоимость = 100 · выбранный режим доходности"
        >
          <TimeChart data={wealth} series={companySeries(mode)} kind="area" height={290} />
        </Card>
        <Card title="Краткий вывод">
          <div className="overview-status">
            {cs.map((c) => (
              <div key={c}>
                <strong>{companies[c].name}</strong>
                <p>{stability(data.financial, c).category}</p>
                <small>Риск акции: {marketRisk(model.stats[c]).toLowerCase()}</small>
              </div>
            ))}
          </div>
          <p className="compact-insight">
            {mode === 'compare'
              ? model.conclusions[1]
              : `Исторический CAGR ${pct(stat?.cagr, 2)}; максимальная просадка ${pct(stat?.maxDrawdown)}. Прибыль компании не исключает убытка по акции.`}
          </p>
          <button className="text-button" onClick={() => navigate('stability')}>
            Обоснование оценки →
          </button>
        </Card>
      </div>
      <Disclosure title="Сводка показателей">
        <IndicatorSummary data={data} model={model} mode={mode} />
      </Disclosure>
      <Disclosure title="Подробнее">
        <h3>Сопоставимые доходности</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Акция</th>
                <th>
                  Ценовой CAGR <MetricHelp metric="cagr" />
                </th>
                <th>С дивидендами</th>
                <th>Ценовой CAGR 2021–2025</th>
              </tr>
            </thead>
            <tbody>
              {cs.map((c) => (
                <tr key={c}>
                  <th>{companies[c].name}</th>
                  <td data-testid={`cagr-price-${c}`}>{pct(model.comparison[c].price?.cagr, 2)}</td>
                  <td data-testid={`cagr-total-${c}`}>{pct(model.comparison[c].total?.cagr, 2)}</td>
                  <td>{pct(model.fiveYear[c].price?.cagr, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="footnote">
          Оба режима рассчитаны на {date(model.period.from)} — {date(model.period.till)}; n ={' '}
          {fmt(model.period.years, 4)} года. Полный пятилетний дивидендный ряд T отсутствует.
          Реинвестирование условно выполняется в дату реестра, без налогов и комиссий.
        </p>
        <h3>
          Исторический P/E · 2025 <MetricHelp metric="pe" />
        </h3>
        {model.valuations
          .filter((v) => v.year === 2025 && cs.includes(v.company))
          .map((v) => (
            <p key={v.company}>
              {v.company}: {fmt(v.pe, 2)} × = {fmt(v.price, 2)} ₽ / EPS {fmt(v.eps, 3)} ₽.
            </p>
          ))}
        <p className="footnote">
          P/E ретроспективный: EPS опубликована позже даты цены. Низкий мультипликатор не доказывает
          недооценку. Исходные значения и ссылки доступны в финансовом анализе.
        </p>
      </Disclosure>
    </>
  );
}
