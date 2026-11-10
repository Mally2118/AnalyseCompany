import { z } from 'zod';
import type { MarketData } from '../data/types';
const finite = z.number().finite();
const positive = finite.positive();
const method = z.enum(['interpolation', 'market', 'market-sector']);
const fit = z.object({
  method: z.enum(['market', 'market-sector']),
  n: finite.int().min(60),
  from: z.iso.date(),
  till: z.iso.date(),
  coefficients: z.array(finite).min(2).max(3),
  r2: finite,
  vif: positive,
});
const quality = z.object({
  phase: z.enum(['validation', 'test']),
  method,
  mode: z.enum(['bridge', 'conditional-forward']),
  length: finite.nullable(),
  folds: finite.int().positive(),
  eligible: z.boolean(),
  mae: finite.nonnegative(),
  rmse: finite.nonnegative(),
  relativeRmse: finite.nonnegative(),
});
export const recoverySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  marketFileSha256: z.string().regex(/^[a-f0-9]{64}$/),
  inputsFileSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sources: z.array(z.object({ id: z.string(), title: z.string(), url: z.url() })),
  summary: z.object({
    dates: finite.int(),
    missing: finite.int(),
    actualRecovered: z.literal(0),
    estimated: finite.int(),
    leftUnestimated: finite.int(),
  }),
  bridge: z.object({
    leftDate: z.iso.date(),
    rightDate: z.iso.date(),
    leftPrice: positive,
    rightPrice: positive,
    intervals: finite.int().positive(),
    correction: finite,
  }),
  selectedMethod: method,
  selectedFactorModel: z.enum(['market', 'market-sector']),
  models: z
    .array(
      fit.extend({
        residuals: z.object({
          mean: finite,
          std: finite.nonnegative(),
          lag1: finite,
          durbinWatson: finite,
          skewness: finite,
          kurtosis: finite,
          jarqueBeraP: finite.min(0).max(1),
        }),
        coefficientIntervalsHAC95: z.array(z.tuple([finite, finite])),
        stability: z.array(fit.nullable()).length(2),
      }),
    )
    .length(2),
  validation: z.array(quality),
  folds: z.array(
    z.object({
      regime: z.string(),
      from: z.iso.date(),
      till: z.iso.date(),
      leftAnchor: z.iso.date(),
      rightAnchor: z.iso.date(),
      length: finite.int().positive(),
      phase: z.enum(['validation', 'test']),
      method,
      mode: z.enum(['bridge', 'conditional-forward']),
      eligible: z.boolean(),
      trainFrom: z.iso.date().optional(),
      trainTill: z.iso.date().optional(),
      n: finite.optional(),
      coefficients: z.array(finite).optional(),
      r2: finite.optional(),
      vif: finite.optional(),
      mae: finite.nonnegative(),
      rmse: finite.nonnegative(),
      relativeRmse: finite.nonnegative(),
    }),
  ),
  regimes: z.array(z.object({ from: z.iso.date(), till: z.iso.date(), name: z.string() })),
  methodology: z.array(z.string()),
  observations: z.array(
    z.object({
      date: z.iso.date(),
      actualPrice: positive.nullable(),
      estimatedPrice: positive.nullable(),
      regressionPrice: positive.nullable(),
      interpolatedPrice: positive.nullable(),
      status: z.enum(['actual', 'estimated', 'no-trading']),
      method: z.enum(['none', 'regression', 'interpolation']),
      category: z.enum(['actual', 'suspension', 'corporate-action', 'instrument-calendar']),
      tradable: z.boolean(),
      reason: z.string(),
      sourceIds: z.array(z.string()),
      lower: positive.nullable(),
      upper: positive.nullable(),
    }),
  ),
});
export type RecoveryData = z.infer<typeof recoverySchema>;
export function validateRecovery(
  input: unknown,
  market: MarketData,
  marketFileHash?: string,
): RecoveryData {
  const d = recoverySchema.parse(input);
  if (marketFileHash && d.marketFileSha256 !== marketFileHash)
    throw new Error('Исследование устарело: исходные котировки изменились.');
  const ids = new Set(d.sources.map((s) => s.id));
  if (d.observations.length !== market.quotes.length)
    throw new Error('Нарушен календарь исследования');
  for (const [i, r] of d.observations.entries()) {
    const original = market.quotes[i];
    if (r.date !== original.date || r.actualPrice !== original.T)
      throw new Error('Изменён фактический ряд');
    if (r.sourceIds.some((id) => !ids.has(id))) throw new Error('Нет источника котировки');
    if (
      r.actualPrice !== null &&
      (r.status !== 'actual' || r.estimatedPrice !== null || !r.tradable || r.method !== 'none')
    )
      throw new Error('Оценка подменила факт');
    if (r.actualPrice === null && r.tradable) throw new Error('Неторговая дата объявлена торговой');
    if (
      r.estimatedPrice !== null &&
      (r.status !== 'estimated' || r.method === 'none' || r.category !== 'corporate-action')
    )
      throw new Error('Недопустимая оценка');
    if (
      r.actualPrice === null &&
      r.estimatedPrice === null &&
      (r.status !== 'no-trading' || r.method !== 'none')
    )
      throw new Error('Неверный статус пропуска');
    if (
      (r.lower === null) !== (r.upper === null) ||
      (r.lower !== null &&
        r.upper !== null &&
        (r.estimatedPrice === null || r.lower > r.estimatedPrice || r.upper < r.estimatedPrice))
    )
      throw new Error('Неверный интервал');
  }
  const missing = d.observations.filter((r) => r.actualPrice === null).length;
  const estimated = d.observations.filter((r) => r.estimatedPrice !== null).length;
  if (
    d.summary.dates !== d.observations.length ||
    d.summary.missing !== missing ||
    d.summary.estimated !== estimated ||
    d.summary.leftUnestimated !== missing - estimated
  )
    throw new Error('Неверные счётчики восстановления');
  for (const f of d.folds)
    if (f.trainTill && f.trainTill >= f.from) throw new Error('Утечка будущего в обучение');
  for (const m of d.models)
    if (
      m.coefficients.length !== (m.method === 'market' ? 2 : 3) ||
      m.coefficientIntervalsHAC95.length !== m.coefficients.length
    )
      throw new Error('Неверная размерность регрессии');
  if (!d.models.some((m) => m.method === d.selectedFactorModel))
    throw new Error('Нет выбранной модели');
  for (const phase of ['validation', 'test']) {
    const scores = d.validation.filter(
      (q) => q.phase === phase && q.mode === 'bridge' && q.length === null,
    );
    if (scores.length !== 3 || new Set(scores.map((q) => q.method)).size !== 3)
      throw new Error('Неполная проверка моделей');
  }
  for (const q of d.observations.filter((q) => q.estimatedPrice !== null)) {
    if (
      q.estimatedPrice !==
      (d.selectedMethod === 'interpolation' ? q.interpolatedPrice : q.regressionPrice)
    )
      throw new Error('Оценка не соответствует выбранному методу');
    if (q.date < '2024-02-16' || q.date > '2024-03-15')
      throw new Error('Оценка вне проверенной остановки');
  }
  return d;
}
export async function sha256Text(text: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
