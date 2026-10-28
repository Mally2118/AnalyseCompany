import type { Company, FinancialData, Metric } from '../data/types';
import { fact } from './analysis';
import { cagr } from './statistics';
/** A reproducible ratio on average opening/closing balances; not the issuer's published average-monthly ROA. */
export function balanceROA(data: FinancialData, c: Company, year: number): number | null {
  const profit = fact(data, c, year, 'profit'),
    before = fact(data, c, year - 1, 'assets'),
    after = fact(data, c, year, 'assets');
  if (profit === null || before === null || after === null || before <= 0 || after <= 0)
    return null;
  return (profit / ((before + after) / 2)) * 100;
}
export function comparableCagr(data: FinancialData, c: Company, metric: Metric): number | null {
  const series = data.facts
    .filter((f) => f.company === c && f.metric === metric)
    .sort((a, b) => a.year - b.year);
  if (series.length < 2 || series.some((f) => !f.comparable || f.value === null || f.value <= 0))
    return null;
  return cagr(series[0].value!, series.at(-1)!.value!, series.at(-1)!.year - series[0].year);
}
