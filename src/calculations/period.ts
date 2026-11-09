import type { MarketData } from '../data/types';
export interface AnalysisPeriod {
  requestedStart: string;
  from: string;
  till: string;
  years: number;
  limited: boolean;
}
export function elapsedYears(from: string, till: string): number {
  const duration = (Date.parse(till) - Date.parse(from)) / (365.25 * 86400000);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Некорректный период');
  return duration;
}
/** One calendar window for both securities AND both return conventions. */
export function analysisPeriod(data: MarketData, firstYear: number): AnalysisPeriod {
  if (firstYear !== 2021 && firstYear !== 2023) throw new Error('Неподдерживаемый период');
  const requestedStart = data.monthly
    .filter((q) => q.date < `${firstYear}-01-01` && q.SBER !== null && q.T !== null)
    .at(-1)?.date;
  const till = data.monthly.filter((q) => q.SBER !== null && q.T !== null).at(-1)?.date;
  if (!requestedStart || !till) throw new Error('Нет границ периода');
  const threshold = [requestedStart, data.totalAvailableFrom.SBER, data.totalAvailableFrom.T]
    .sort()
    .at(-1)!;
  const from = data.quotes.find(
    (q) => q.date >= threshold && q.date <= till && q.SBER !== null && q.T !== null,
  )?.date;
  if (!from) throw new Error('Нет общего сопоставимого периода');
  return {
    requestedStart,
    from,
    till,
    years: elapsedYears(from, till),
    limited: from !== requestedStart,
  };
}
