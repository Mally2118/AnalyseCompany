import type { DataSet } from '../services/data';
import type { Company, ReturnKind, Scenario } from '../data/types';
import { analysisPeriod, elapsedYears } from './period';
import { monthlyReturns, paired, statistics, wealthSeries } from './market';
import { frontier, portfolioWealth } from './portfolio';
import { cagr, correlation, compound } from './statistics';
import { fact, conclusions } from './analysis';
import { scenarioResult } from './scenarios';
import { historicalValuations } from './valuation';
import { allocation } from './calculator';
import { pct, rub } from '../utils/format';
const securities: Company[] = ['SBER', 'T'];
export function marketResearch(data: DataSet, kind: ReturnKind, start: number, rf: number) {
  const period = analysisPeriod(data.market, start);
  const rows = monthlyReturns(data.market, kind, period),
    pair = paired(rows);
  const model = pair.rows.length >= 2 ? frontier(pair.SBER, pair.T, rf) : null;
  const wealth = {
    SBER: wealthSeries(data.market, 'SBER', kind, period).filter(
      (q) => q.date >= period.from && q.date <= period.till,
    ),
    T: wealthSeries(data.market, 'T', kind, period).filter(
      (q) => q.date >= period.from && q.date <= period.till,
    ),
  };
  const stats = {
    SBER: statistics(pair.SBER, rf, wealth.SBER),
    T: statistics(pair.T, rf, wealth.T),
  };
  return {
    period,
    rows,
    pair,
    model,
    wealth,
    stats,
    correlation: pair.rows.length >= 2 ? correlation(pair.SBER, pair.T) : null,
  };
}
export function createResearchModel(
  data: DataSet,
  kind: ReturnKind,
  start: number,
  rf: number,
  weight: number,
  amount: number,
  scenarios: Scenario[],
  horizon = 1,
) {
  const analysis = marketResearch(data, kind, start, rf),
    { period, model, stats, wealth } = analysis;
  const other = marketResearch(data, kind === 'price' ? 'total' : 'price', start, rf);
  const comparison = {
    SBER: {
      price: kind === 'price' ? stats.SBER : other.stats.SBER,
      total: kind === 'total' ? stats.SBER : other.stats.SBER,
    },
    T: {
      price: kind === 'price' ? stats.T : other.stats.T,
      total: kind === 'total' ? stats.T : other.stats.T,
    },
  };
  const rebalance = data.market.monthly
    .filter((q) => q.SBER !== null && q.T !== null)
    .map((q) => q.date);
  const geometry = (w: number) => {
    const series = portfolioWealth(wealth.SBER, wealth.T, w, rebalance),
      first = series.find((q) => q.value !== null),
      last = series.filter((q) => q.value !== null).at(-1);
    return {
      series,
      cagr:
        first && last ? cagr(first.value!, last.value!, elapsedYears(first.date, last.date)) : null,
    };
  };
  const historical = {
    selected: geometry(weight),
    min: model ? geometry(model.min.weight) : null,
    max: model ? geometry(model.max.weight) : null,
  };
  const fiveYearPeriod = { from: data.market.from, till: period.till };
  const benchmark = (c: Company, k: ReturnKind) => {
    if (k === 'total' && data.market.totalAvailableFrom[c] > fiveYearPeriod.from) return null;
    const values = monthlyReturns(data.market, k, fiveYearPeriod).flatMap((r) =>
      r[c] === null ? [] : [r[c]],
    );
    return statistics(
      values,
      rf,
      wealthSeries(data.market, c, k, fiveYearPeriod).filter(
        (q) => q.date >= fiveYearPeriod.from && q.date <= fiveYearPeriod.till,
      ),
    );
  };
  const fiveYear = {
    SBER: { price: benchmark('SBER', 'price'), total: benchmark('SBER', 'total') },
    T: { price: benchmark('T', 'price'), total: benchmark('T', 'total') },
  };
  const fullAvailable = securities.every(
    (c) => (c === 'SBER' ? weight : 1 - weight) === 0 || fiveYear[c][kind] !== null,
  );
  let fiveYearPortfolio: { annualMean: number; cagr: number | null } | null = null;
  if (fullAvailable) {
    const a = wealthSeries(data.market, 'SBER', kind, fiveYearPeriod).filter(
        (q) => q.date >= fiveYearPeriod.from && q.date <= fiveYearPeriod.till,
      ),
      b = wealthSeries(data.market, 'T', kind, fiveYearPeriod).filter(
        (q) => q.date >= fiveYearPeriod.from && q.date <= fiveYearPeriod.till,
      );
    // A zero-weight asset must not move the initial date of a 100% position.
    const portfolio =
        weight === 1 ? a : weight === 0 ? b : portfolioWealth(a, b, weight, rebalance),
      first = portfolio.find((q) => q.value !== null),
      last = portfolio.filter((q) => q.value !== null).at(-1);
    fiveYearPortfolio = {
      annualMean:
        weight * (fiveYear.SBER[kind]?.annualMean ?? 0) +
        (1 - weight) * (fiveYear.T[kind]?.annualMean ?? 0),
      cagr:
        first && last ? cagr(first.value!, last.value!, elapsedYears(first.date, last.date)) : null,
    };
  }
  const valuations = historicalValuations(data.financial, data.market),
    last = data.market.monthly.at(-1)!,
    eps = {
      SBER: fact(data.financial, 'SBER', 2025, 'eps'),
      T: fact(data.financial, 'T', 2025, 'eps'),
    };
  const results =
    eps.SBER && eps.T && last.SBER && last.T
      ? scenarios.map((s) =>
          scenarioResult(
            s,
            { SBER: eps.SBER!, T: eps.T! },
            { SBER: last.SBER!, T: last.T! },
            weight,
            amount,
          ),
        )
      : [];
  const capital = allocation(amount, weight);
  const summary = conclusions(data.financial, stats, model, { sameHorizon: true });
  summary.push(
    `Общая временная база: ${period.from} — ${period.till}. CAGR выбранного портфеля ${pct(historical.selected.cagr)}; оценка Марковица ${pct(model?.points[Math.round(weight * 100)]?.mean)} — арифметическая по ${analysis.pair.rows.length} общим месяцам.`,
  );
  summary.push(
    `Капитал ${rub(amount)}: Сбер ${rub(capital.SBER)}, Т ${rub(capital.T)}. Результаты при горизонте ${horizon} лет: ${results.map((r) => `${r.name.toLowerCase()} — ${rub(compound(amount, r.return, horizon))}, прибыль/убыток ${rub(compound(amount, r.return, horizon) - amount)}`).join('; ')}. При горизонте более года ставка сценария повторяется как учебное допущение.`,
  );
  return {
    ...analysis,
    comparison,
    historical,
    fiveYear,
    fiveYearPortfolio,
    valuations,
    allocation: capital,
    selected: model?.points[Math.round(weight * 100)] ?? null,
    results,
    conclusions: summary,
    eps,
  };
}
