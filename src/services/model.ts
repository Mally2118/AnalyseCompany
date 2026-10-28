import { useMemo } from 'react';
import type { Company, ReturnKind, Scenario } from '../data/types';
import type { DataSet } from './data';
import { monthlyReturns, paired, statistics, wealthSeries } from '../calculations/market';
import { correlation } from '../calculations/statistics';
import { frontier } from '../calculations/portfolio';
import { fact, conclusions } from '../calculations/analysis';
import { scenarioResult } from '../calculations/scenarios';
export function useModel(
  data: DataSet,
  kind: ReturnKind,
  start: number,
  rf: number,
  weight: number,
  amount: number,
  scenarios: Scenario[],
) {
  return useMemo(() => {
    const rows = monthlyReturns(data.market, kind).filter(
        (r) => Number(r.date.slice(0, 4)) >= start,
      ),
      pair = paired(rows),
      model = pair.rows.length >= 2 ? frontier(pair.SBER, pair.T, rf) : null;
    const wealth = {
      SBER: wealthSeries(data.market, 'SBER', kind).filter((q) => q.date >= `${start - 1}-12-01`),
      T: wealthSeries(data.market, 'T', kind).filter((q) => q.date >= `${start - 1}-12-01`),
    };
    // Anchor wealth at the final observation preceding the requested period.
    for (const c of ['SBER', 'T'] as Company[]) {
      const baseline = wealth[c].filter((q) => q.date < `${start}-01-01`).at(-1);
      wealth[c] = wealth[c].filter((q) => q.date >= `${start}-01-01`);
      if (baseline) wealth[c].unshift(baseline);
      const first = wealth[c].find((q) => q.value !== null)?.value;
      if (first)
        wealth[c] = wealth[c].map((q) => ({
          ...q,
          value: q.value === null ? null : q.value / first,
        }));
    }
    const stats = {
      SBER: statistics(
        rows.flatMap((r) => (r.SBER === null ? [] : [r.SBER])),
        rf,
        wealth.SBER,
      ),
      T: statistics(
        rows.flatMap((r) => (r.T === null ? [] : [r.T])),
        rf,
        wealth.T,
      ),
    };
    const last = data.market.monthly.at(-1)!,
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
    return {
      rows,
      pair,
      model,
      wealth,
      stats,
      selected: model?.points[Math.round(weight * 100)] ?? null,
      correlation: pair.rows.length >= 2 ? correlation(pair.SBER, pair.T) : null,
      results,
      conclusions: conclusions(data.financial, stats, model, {
        sameHorizon: kind !== 'total' || start >= 2023,
      }),
      eps,
    };
  }, [data, kind, start, rf, weight, amount, scenarios]);
}
export type AnalysisModel = ReturnType<typeof useModel>;
