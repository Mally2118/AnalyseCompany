import type { MarketData, ReturnKind } from '../data/types';
import type { DataSet } from '../services/data';
import type { RecoveryData } from '../services/recovery';
import { marketResearch } from './research';
export const recoveryMethodNames: Record<string, string> = {
  interpolation: 'Интерполяция log(P)',
  market: 'IMOEX',
  'market-sector': 'IMOEX + SBER',
  regression: 'Рыночная регрессия',
  none: 'Не применяется',
};
/** A separate counterfactual input: never mutates the official market or supplies executions. */
export function researchMarket(market: MarketData, recovery: RecoveryData): MarketData {
  const estimates = new Map(
    recovery.observations
      .filter((q) => q.estimatedPrice !== null)
      .map((q) => [q.date, q.estimatedPrice!]),
  );
  const quotes = market.quotes.map((q) =>
    q.T === null && estimates.has(q.date)
      ? { ...q, T: estimates.get(q.date)!, note: 'Условная модельная стоимость; сделка невозможна' }
      : { ...q },
  );
  const byDate = new Map(quotes.map((q) => [q.date, q]));
  const monthly = market.monthly.map((q) =>
    q.T === null && estimates.has(q.date) ? { ...byDate.get(q.date)! } : { ...q },
  );
  return { ...market, quotes, monthly };
}
/** Log-price interpolation for N intervals, excluding both observed anchors. */
export function logPriceBridge(left: number, right: number, intervals: number) {
  if (
    !Number.isFinite(left + right) ||
    left <= 0 ||
    right <= 0 ||
    !Number.isInteger(intervals) ||
    intervals < 2
  )
    throw new Error('Неверные опорные цены');
  return Array.from(
    { length: intervals - 1 },
    (_, i) => left * Math.exp((Math.log(right / left) * (i + 1)) / intervals),
  );
}
/** Retrospective log-return bridge; the end observation is included in raw returns. */
export function returnBridge(left: number, right: number, returns: readonly number[]) {
  if (
    !Number.isFinite(left + right) ||
    left <= 0 ||
    right <= 0 ||
    returns.length < 2 ||
    returns.some((r) => !Number.isFinite(r))
  )
    throw new Error('Неверный мост доходностей');
  const correction = (Math.log(right / left) - returns.reduce((a, b) => a + b, 0)) / returns.length;
  let p = left;
  return returns.map((r) => (p *= Math.exp(r + correction)));
}
export function recoverySensitivity(
  data: DataSet,
  recovery: RecoveryData,
  kind: ReturnKind,
  start: number,
  rf: number,
  weight: number,
) {
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error('Неверный вес');
  const restored = researchMarket(data.market, recovery);
  const before = marketResearch(data, kind, start, rf);
  const after = marketResearch({ ...data, market: restored }, kind, start, rf);
  const select = (a: typeof before) => ({
    ...a,
    selected: a.model?.points[Math.round(weight * 100)] ?? null,
  });
  return {
    before: select(before),
    after: select(after),
    addedMonths: after.pair.rows
      .filter((q) => !before.pair.rows.some((r) => r.date === q.date))
      .map((q) => q.date),
  };
}
