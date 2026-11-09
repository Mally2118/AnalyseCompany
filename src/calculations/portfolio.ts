import type { Portfolio } from '../data/types';
import { covariance, mean, variance } from './statistics';
export function portfolioRisk(weight: number, varA: number, varB: number, cov: number): number {
  if (
    ![weight, varA, varB, cov].every(Number.isFinite) ||
    weight < 0 ||
    weight > 1 ||
    varA < 0 ||
    varB < 0 ||
    Math.abs(cov) > Math.sqrt(varA * varB) + 1e-12
  )
    throw new Error('Недопустимые веса или ковариация');
  const v = weight ** 2 * varA + (1 - weight) ** 2 * varB + 2 * weight * (1 - weight) * cov;
  return Math.sqrt(Math.max(0, v));
}
export function frontier(a: number[], b: number[], rfAnnual: number) {
  if (!Number.isFinite(rfAnnual) || rfAnnual <= -1)
    throw new Error('Некорректная безрисковая ставка');
  const cov = covariance(a, b),
    va = variance(a),
    vb = variance(b),
    ma = mean(a),
    mb = mean(b),
    rf = (1 + rfAnnual) ** (1 / 12) - 1;
  const points: Portfolio[] = Array.from({ length: 101 }, (_, i) => {
    const w = i / 100,
      m = w * ma + (1 - w) * mb,
      sd = portfolioRisk(w, va, vb, cov);
    return {
      weight: w,
      mean: m * 12,
      risk: sd * Math.sqrt(12),
      sharpe: sd > 0 ? ((m - rf) / sd) * Math.sqrt(12) : null,
      efficient: false,
    };
  });
  for (const p of points)
    p.efficient = !points.some(
      (q) =>
        q.risk <= p.risk + 1e-12 &&
        q.mean >= p.mean - 1e-12 &&
        (q.risk < p.risk - 1e-12 || q.mean > p.mean + 1e-12),
    );
  const min = points.reduce((a, b) => (b.risk < a.risk ? b : a)),
    max = points.reduce((a, b) => ((b.sharpe ?? -Infinity) > (a.sharpe ?? -Infinity) ? b : a));
  return {
    points,
    min,
    max,
    covariance: [
      [va * 12, cov * 12],
      [cov * 12, vb * 12],
    ],
    means: [ma * 12, mb * 12],
  };
}
export function portfolioReturns(a: number[], b: number[], w: number) {
  if (a.length !== b.length || w < 0 || w > 1) throw new Error('Несинхронные доходности или вес');
  return a.map((v, i) => w * v + (1 - w) * b[i]);
}

/** Daily marked-to-market history. Rebalance only at observed common month-end dates.
 * Missing months are held through, never filled with zero returns or removed from elapsed time.
 */
export function portfolioWealth(
  a: { date: string; value: number | null }[],
  b: { date: string; value: number | null }[],
  weight: number,
  rebalancingDates: readonly string[],
) {
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error('Недопустимый вес');
  const dates = new Set(rebalancingDates),
    other = new Map(b.map((q) => [q.date, q.value]));
  let unitsA: number | null = null,
    unitsB: number | null = null;
  return a.map((q) => {
    const av = q.value,
      bv = other.get(q.date) ?? null;
    if (unitsA === null || unitsB === null) {
      if (av === null || bv === null) return { date: q.date, value: null };
      unitsA = weight / av;
      unitsB = (1 - weight) / bv;
    }
    if ((av === null && unitsA !== 0) || (bv === null && unitsB !== 0))
      return { date: q.date, value: null };
    const value = unitsA * (av ?? 0) + unitsB * (bv ?? 0);
    if (dates.has(q.date) && av !== null && bv !== null) {
      unitsA = (weight * value) / av;
      unitsB = ((1 - weight) * value) / bv;
    }
    return { date: q.date, value };
  });
}
