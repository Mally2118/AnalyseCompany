import type { Company, MarketData, Quote, ReturnKind, ReturnRow, Stats } from '../data/types';
import { cagr, mean, stdev, maxDrawdown, quantile } from './statistics';
export function periodicReturn(
  previous: number | null,
  current: number | null,
  dividend: number | null = 0,
): number | null {
  if (previous === null || current === null || dividend === null) return null;
  if (
    !Number.isFinite(previous + current + dividend) ||
    previous <= 0 ||
    current <= 0 ||
    dividend < 0
  )
    throw new Error('Некорректная цена или дивиденд');
  return (current - previous + dividend) / previous;
}
export function splitAdjusted(price: number, ratio: number): number {
  if (!Number.isFinite(price + ratio) || price <= 0 || ratio <= 0)
    throw new Error('Некорректный сплит');
  return price / ratio;
}
function monthIndex(date: string) {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
}
/** Cash entitlement is credited at documented model event date and reinvested at that day's close. Fractional shares, no taxes/fees. */
export function wealthSeries(
  data: MarketData,
  company: Company,
  kind: ReturnKind,
): { date: string; value: number | null }[] {
  let shares: number | null = null;
  return data.quotes.map((q) => {
    const p = q[company];
    if (q.date < data.from || (kind === 'total' && q.date < data.totalAvailableFrom[company]))
      return { date: q.date, value: null };
    if (p === null) return { date: q.date, value: null };
    if (shares === null) shares = 1 / p;
    else if (kind === 'total') {
      const d = data.dividends
        .filter((d) => d.company === company && d.date === q.date)
        .reduce((s, d) => s + d.amount, 0);
      shares *= 1 + d / p;
    }
    return { date: q.date, value: shares * p };
  });
}
export function monthlyReturns(data: MarketData, kind: ReturnKind): ReturnRow[] {
  const wealth = {
    SBER: new Map(wealthSeries(data, 'SBER', kind).map((q) => [q.date, q.value])),
    T: new Map(wealthSeries(data, 'T', kind).map((q) => [q.date, q.value])),
  };
  // Values are taken at common trading dates. A month with no common observation stays null.
  const prices = data.monthly;
  return prices.slice(1).map((q, i) => {
    const prev = prices[i];
    const adjacent = monthIndex(q.date) - monthIndex(prev.date) === 1;
    const result = (c: Company) =>
      adjacent && q[c] !== null && prev[c] !== null
        ? periodicReturn(wealth[c].get(prev.date) ?? null, wealth[c].get(q.date) ?? null)
        : null;
    return {
      date: q.date,
      SBER: result('SBER'),
      T: result('T'),
      priceSBER: adjacent ? periodicReturn(prev.SBER, q.SBER) : null,
      priceT: adjacent ? periodicReturn(prev.T, q.T) : null,
    };
  });
}
export function paired(rows: ReturnRow[]) {
  const valid = rows.filter(
    (r): r is ReturnRow & { SBER: number; T: number } => r.SBER !== null && r.T !== null,
  );
  return { rows: valid, SBER: valid.map((r) => r.SBER), T: valid.map((r) => r.T) };
}
export function statistics(
  returns: readonly number[],
  rf: number,
  wealth: { date: string; value: number | null }[],
): Stats | null {
  if (returns.length < 2) return null;
  const m = mean(returns),
    sd = stdev(returns);
  const values = wealth.filter((r): r is { date: string; value: number } => r.value !== null);
  const a = values[0],
    b = values.at(-1);
  const years = a && b ? (Date.parse(b.date) - Date.parse(a.date)) / (365.25 * 86400000) : 0;
  return {
    n: returns.length,
    monthlyMean: m,
    annualMean: m * 12,
    monthlyVol: sd,
    annualVol: sd * Math.sqrt(12),
    sharpe: sd > 0 ? ((m - ((1 + rf) ** (1 / 12) - 1)) / sd) * Math.sqrt(12) : null,
    cagr: a && b ? cagr(a.value, b.value, years) : null,
    maxDrawdown: maxDrawdown(values.map((v) => v.value)),
    var95: returns.length >= 24 ? Math.max(0, -quantile(returns, 0.05)) : null,
    wealth: a && b ? b.value / a.value : null,
  };
}
export function normalizedPrices(quotes: Quote[], c: Company) {
  const start = quotes.find((q) => q[c] !== null)?.[c];
  return quotes.map((q) => ({
    date: q.date,
    value: start && q[c] !== null ? (q[c] / start) * 100 : null,
  }));
}
