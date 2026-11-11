import type { Company, MarketData } from '../data/types';
import type { AnalysisPeriod } from '../calculations/period';

export type HistoryMode = 'index' | 'price';
export interface HistoryPoint {
  date: string;
  SBER: number | null;
  T: number | null;
}
interface WealthPoint {
  date: string;
  value: number | null;
}

/** Display data only: quoted prices and investment indices keep their separate time bases. */
export function historyData(
  market: MarketData,
  wealth: Record<Company, WealthPoint[]>,
  period: Pick<AnalysisPeriod, 'requestedStart' | 'till'>,
  display: HistoryMode,
): HistoryPoint[] {
  if (display === 'price')
    return market.quotes
      .filter((q) => q.date >= period.requestedStart && q.date <= period.till)
      .map((q) => ({ date: q.date, SBER: q.SBER, T: q.T }));

  const values = {
    SBER: new Map(wealth.SBER.map((q) => [q.date, q.value])),
    T: new Map(wealth.T.map((q) => [q.date, q.value])),
  };
  const dates = new Set([...values.SBER.keys(), ...values.T.keys()]);
  return [...dates].sort().map((date) => {
    const sber = values.SBER.get(date),
      t = values.T.get(date);
    return {
      date,
      SBER: sber == null ? null : sber * 100,
      T: t == null ? null : t * 100,
    };
  });
}
