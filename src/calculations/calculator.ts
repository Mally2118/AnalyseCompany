import { compound } from './statistics';
export const investmentLimits = { min: 10000, max: 1000000, step: 10000, initial: 100000 } as const;
export function allocation(amount: number, weight: number) {
  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(weight) ||
    amount < 0 ||
    weight < 0 ||
    weight > 1
  )
    throw new Error('Недопустимые сумма или вес');
  const SBER = amount * weight;
  return { SBER, T: amount - SBER };
}

export type CalculatorMode = 'history' | 'scenario';
export const historicalExplanation =
  'Расчёт показывает, как изменилась бы стоимость инвестиций, если бы исторический среднегодовой темп роста повторился в будущем. Это математическая иллюстрация, а не прогноз';
/** Rate is a decimal CAGR of the actual portfolio NAV, never a mean of asset CAGRs. */
export function historicalCalculation(amount: number, rate: number | null, horizon: number) {
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isInteger(horizon) ||
    horizon < 1 ||
    horizon > 10
  )
    throw new Error('Недопустимые сумма или горизонт');
  if (rate === null) return null;
  if (!Number.isFinite(rate) || rate <= -1) throw new Error('Недопустимый CAGR');
  const path = Array.from({ length: horizon + 1 }, (_, year) => ({
    year,
    value: compound(amount, rate, year),
  }));
  if (path.some((q) => !Number.isFinite(q.value)))
    throw new Error('Результат выходит за числовой диапазон');
  const value = path.at(-1)!.value;
  return { path, cagr: rate, value, profit: value - amount, horizon };
}
