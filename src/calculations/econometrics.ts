import { mean } from './statistics';
/** Only one interior gap, observed neighbours, no structural break between anchors. */
export function interpolate(
  t: number,
  left: { t: number; value: number },
  right: { t: number; value: number },
  breaks: number[] = [],
) {
  if (
    ![t, left.t, left.value, right.t, right.value].every(Number.isFinite) ||
    !(left.t < t && t < right.t) ||
    right.t - left.t !== 2 ||
    breaks.some((b) => b > left.t && b <= right.t)
  )
    return null;
  return left.value + ((t - left.t) / (right.t - left.t)) * (right.value - left.value);
}
/** Univariate OLS, chronological 75/25 hold-out; never a five-point multiple regression. */
export function regressionEstimate(
  x: number[],
  y: number[],
  target: number,
  breakInSample = false,
) {
  if (
    x.length !== y.length ||
    x.length < 12 ||
    breakInSample ||
    ![...x, ...y, target].every(Number.isFinite)
  )
    return {
      value: null,
      reason: 'Нужно ≥12 сопоставимых наблюдений и отсутствие структурного разрыва.',
    };
  const cut = Math.floor(x.length * 0.75),
    fit = (a: number[], b: number[]) => {
      const mx = mean(a),
        my = mean(b),
        den = a.reduce((s, v) => s + (v - mx) ** 2, 0);
      if (den === 0) return null;
      const slope = a.reduce((s, v, i) => s + (v - mx) * (b[i] - my), 0) / den;
      return { slope, intercept: my - slope * mx };
    };
  const train = fit(x.slice(0, cut), y.slice(0, cut));
  if (!train) return { value: null, reason: 'Фактор не меняется.' };
  const actual = y.slice(cut),
    avg = mean(actual),
    sse = actual.reduce(
      (s, v, i) => s + (v - (train.intercept + train.slope * x[cut + i])) ** 2,
      0,
    ),
    sst = actual.reduce((s, v) => s + (v - avg) ** 2, 0);
  const r2 = sst > 0 ? 1 - sse / sst : null;
  if (r2 === null || r2 < 0.5 || target < Math.min(...x) || target > Math.max(...x))
    return {
      value: null,
      r2,
      reason: 'Неудовлетворительная проверка на отложенной выборке или экстраполяция.',
    };
  const final = fit(x, y)!;
  return {
    value: final.intercept + final.slope * target,
    r2,
    reason: 'Оценка OLS; R² проверено на последних 25% наблюдений. Интервал не заявляется.',
  };
}
