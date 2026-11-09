export function finite(values: readonly number[]) {
  if (values.some((v) => !Number.isFinite(v))) throw new Error('Нечисловое наблюдение');
}
export function mean(x: readonly number[]): number {
  finite(x);
  if (!x.length) throw new Error('Пустая выборка');
  return x.reduce((a, b) => a + b, 0) / x.length;
}
export function covariance(x: readonly number[], y: readonly number[]): number {
  finite(x);
  finite(y);
  if (x.length !== y.length || x.length < 2) throw new Error('Нужны две синхронные выборки n ≥ 2');
  const mx = mean(x),
    my = mean(y);
  return x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / (x.length - 1);
}
export const variance = (x: readonly number[]) => covariance(x, x);
export const stdev = (x: readonly number[]) => Math.sqrt(variance(x));
export function correlation(x: readonly number[], y: readonly number[]): number | null {
  const d = stdev(x) * stdev(y);
  return d > 0 ? Math.max(-1, Math.min(1, covariance(x, y) / d)) : null;
}
export function drawdowns(values: readonly number[]): number[] {
  finite(values);
  if (values.some((v) => v <= 0)) throw new Error('Стоимость должна быть положительной');
  let peak = values[0] ?? 1;
  return values.map((v) => {
    peak = Math.max(peak, v);
    return v / peak - 1;
  });
}
export function maxDrawdown(values: readonly number[]): number | null {
  return values.length ? Math.min(0, ...drawdowns(values)) : null;
}
export function quantile(x: readonly number[], p: number): number {
  finite(x);
  if (!x.length || !Number.isFinite(p) || p < 0 || p > 1) throw new Error('Некорректный квантиль');
  const s = [...x].sort((a, b) => a - b),
    index = (s.length - 1) * p,
    l = Math.floor(index);
  return s[l] + (s[Math.ceil(index)] - s[l]) * (index - l);
}
/** Geometric annual growth, as a decimal: (P1 / P0)^(1/n) - 1.
 * Calendar market periods pass actual elapsed days / 365.25 as n.
 * Format as percent at the presentation boundary; never substitute for Markowitz's 12 × mean.
 */
export function cagr(start: number, end: number, years: number): number | null {
  return Number.isFinite(start + end + years) && start > 0 && end > 0 && years > 0
    ? (end / start) ** (1 / years) - 1
    : null;
}
export function growth(before: number | null, after: number | null): number | null {
  return before !== null && after !== null && before > 0 ? after / before - 1 : null;
}
export function compound(principal: number, rate: number, years: number): number {
  finite([principal, rate, years]);
  if (principal < 0 || rate <= -1 || years < 0)
    throw new Error('Некорректные параметры сложного процента');
  return principal * (1 + rate) ** years;
}
