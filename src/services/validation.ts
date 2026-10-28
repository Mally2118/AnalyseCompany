import { z } from 'zod';
import type { FinancialData, MarketData } from '../data/types';
import { metrics } from '../data/types';
const number = z.number().finite(),
  nullable = number.nullable();
const source = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  section: z.string(),
  standard: z.string(),
  accessed: z.iso.date(),
  note: z.string(),
});
const quote = z.object({
  date: z.iso.date(),
  SBER: number.positive().nullable(),
  T: number.positive().nullable(),
  tOriginal: number.positive().nullable(),
  tInstrument: z.string(),
  note: z.string(),
});
export const financialSchema = z.object({
  updatedAt: z.string(),
  sources: z.array(source),
  facts: z.array(
    z.object({
      company: z.enum(['SBER', 'T']),
      year: z.number().int().min(2021).max(2025),
      metric: z.enum([
        'profit',
        'assets',
        'equity',
        'nii',
        'fees',
        'roe',
        'roa',
        'cir',
        'capital',
        'npl',
        'cor',
        'eps',
        'dividend',
      ]),
      value: nullable,
      unit: z.enum(['млрд ₽', '%', '₽/акцию']),
      sourceId: z.string(),
      section: z.string(),
      note: z.string(),
      comparable: z.boolean(),
    }),
  ),
});
export const marketSchema = z.object({
  updatedAt: z.string(),
  from: z.iso.date(),
  till: z.iso.date(),
  basis: z.string(),
  sources: z.array(source),
  quotes: z.array(quote).min(1000),
  monthly: z.array(quote).length(61),
  dividends: z.array(
    z.object({
      company: z.enum(['SBER', 'T']),
      date: z.iso.date(),
      amount: number.nonnegative(),
      currency: z.literal('RUB'),
      sourceId: z.string(),
      note: z.string(),
    }),
  ),
  totalAvailableFrom: z.object({ SBER: z.iso.date(), T: z.iso.date() }),
  notes: z.array(z.string()),
  audit: z.object({
    overlap: number.min(500),
    maxRatioError: number.max(0.000001),
    cors: z.string(),
  }),
});
export function validateFinancial(input: unknown): FinancialData {
  const d = financialSchema.parse(input);
  const ids = new Set(d.sources.map((s) => s.id)),
    seen = new Set<string>();
  for (const f of d.facts) {
    const key = `${f.company}-${f.year}-${f.metric}`;
    if (seen.has(key) || !ids.has(f.sourceId))
      throw new Error(`Дубликат или неизвестный источник ${key}`);
    if (f.unit !== metrics[f.metric].unit) throw new Error(`Неверная единица ${key}`);
    seen.add(key);
  }
  for (const c of ['SBER', 'T'])
    for (let y = 2021; y <= 2025; y++)
      for (const m of [
        'profit',
        'assets',
        'equity',
        'nii',
        'fees',
        'roe',
        'roa',
        'cir',
        'capital',
        'npl',
        'cor',
        'eps',
        'dividend',
      ])
        if (!seen.has(`${c}-${y}-${m}`)) throw new Error(`Не описан показатель ${c}-${y}-${m}`);
  return d;
}
export function validateMarket(input: unknown): MarketData {
  const d = marketSchema.parse(input),
    ids = new Set(d.sources.map((s) => s.id));
  for (let i = 1; i < d.quotes.length; i++)
    if (d.quotes[i].date <= d.quotes[i - 1].date) throw new Error('Даты не упорядочены');
  for (let i = 0; i < d.monthly.length; i++) {
    const q = d.monthly[i];
    const expected = new Date(Date.UTC(2020, 11 + i, 1)).toISOString().slice(0, 7);
    if (q.date.slice(0, 7) !== expected)
      throw new Error('Нарушен календарь месяцев 2020-12 — 2025-12');
    if (i && q.date.slice(0, 7) <= d.monthly[i - 1].date.slice(0, 7))
      throw new Error('Повтор месяца');
    if ((q.SBER === null) !== (q.T === null))
      throw new Error('Месячные цены должны быть синхронными');
    if (
      q.SBER !== null &&
      !d.quotes.some((r) => r.date === q.date && r.SBER === q.SBER && r.T === q.T)
    )
      throw new Error('Месячная цена не совпадает с дневной');
  }
  for (const e of d.dividends)
    if (!ids.has(e.sourceId) || !d.quotes.some((q) => q.date === e.date && q[e.company] !== null))
      throw new Error('Непроверенное дивидендное событие');
  return d;
}
