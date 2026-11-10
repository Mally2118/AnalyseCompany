import type { Company, Scenario } from '../data/types';
import { cagr } from './statistics';
export type DividendMode = 'reinvest' | 'cash';
export interface YearAssumption {
  growth: number;
  pe: number;
  payout: number;
  shareFactor: number;
}
export type ProjectionPlans = Record<string, Partial<Record<Company, Partial<YearAssumption>[]>>>;
/** Educational terminal assumptions, not estimated returns or analyst consensus. */
const terminalGrowth = {
  negative: { SBER: 0, T: 5 },
  base: { SBER: 5, T: 5 },
  positive: { SBER: 8, T: 15 },
};
export function defaultPlan(s: Scenario, c: Company): YearAssumption[] {
  const initial = s[c === 'SBER' ? 'growthSBER' : 'growthT'];
  const terminal = terminalGrowth[s.id as keyof typeof terminalGrowth]?.[c] ?? 5;
  return Array.from({ length: 10 }, (_, i) => ({
    growth: i === 0 ? initial : initial + (terminal - initial) * Math.min(i / 4, 1),
    pe: s[c === 'SBER' ? 'peSBER' : 'peT'],
    payout: s[c === 'SBER' ? 'payoutSBER' : 'payoutT'],
    shareFactor: 1,
  }));
}
export function project(
  s: Scenario,
  eps: Record<Company, number>,
  prices: Record<Company, number>,
  weight: number,
  amount: number,
  horizon: number,
  mode: DividendMode,
  plans?: ProjectionPlans,
) {
  if (
    !Number.isInteger(horizon) ||
    horizon < 1 ||
    horizon > 10 ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isFinite(weight) ||
    weight < 0 ||
    weight > 1
  )
    throw new Error('Некорректные параметры прогноза');
  const state = Object.fromEntries(
    (['SBER', 'T'] as const).map((c) => {
      if (!Number.isFinite(eps[c]) || eps[c] <= 0 || !Number.isFinite(prices[c]) || prices[c] <= 0)
        throw new Error('Нет корректной EPS или цены');
      return [
        c,
        {
          eps: eps[c],
          price: prices[c],
          shares: (amount * (c === 'SBER' ? weight : 1 - weight)) / prices[c],
          cash: 0,
        },
      ];
    }),
  ) as Record<Company, { eps: number; price: number; shares: number; cash: number }>;
  const path = [
    {
      year: 2025,
      step: 0,
      value: amount,
      SBER: {
        ...state.SBER,
        dividend: 0,
        dividendCash: 0,
        value: amount * weight,
        growth: 0,
        pe: prices.SBER / eps.SBER,
        payout: 0,
        shareFactor: 1,
      },
      T: {
        ...state.T,
        dividend: 0,
        dividendCash: 0,
        value: amount * (1 - weight),
        growth: 0,
        pe: prices.T / eps.T,
        payout: 0,
        shareFactor: 1,
      },
    },
  ];
  for (let i = 0; i < horizon; i++) {
    const annual = Object.fromEntries(
      (['SBER', 'T'] as const).map((c) => {
        const a =
          i === 0 ? defaultPlan(s, c)[0] : { ...defaultPlan(s, c)[i], ...plans?.[s.id]?.[c]?.[i] };
        if (
          ![a.growth, a.pe, a.payout, a.shareFactor].every(Number.isFinite) ||
          a.growth <= -100 ||
          a.pe <= 0 ||
          a.payout < 0 ||
          a.payout > 100 ||
          a.shareFactor <= 0
        )
          throw new Error('Некорректные годовые предпосылки');
        const v = state[c];
        // Growth is per-share EPS on the previous basis. shareFactor models a split,
        // not dilution: both EPS and share count change reciprocally. No unmodelled issuance.
        v.eps = (v.eps * (1 + a.growth / 100)) / a.shareFactor;
        v.shares *= a.shareFactor;
        v.price = v.eps * a.pe;
        const dividend = (v.eps * a.payout) / 100,
          dividendCash = v.shares * dividend;
        if (mode === 'reinvest') v.shares += dividendCash / v.price;
        else v.cash += dividendCash;
        return [c, { ...v, ...a, dividend, dividendCash, value: v.shares * v.price + v.cash }];
      }),
    ) as Record<Company, (typeof path)[number]['SBER']>;
    const value = annual.SBER.value + annual.T.value;
    if (!Number.isFinite(value)) throw new Error('Прогноз выходит за числовой диапазон');
    path.push({ year: 2026 + i, step: i + 1, value, ...annual });
  }
  const value = path.at(-1)!.value;
  return {
    id: s.id,
    name: s.name,
    color: s.color,
    path,
    value,
    profit: value - amount,
    cagr: cagr(amount, value, horizon),
    mode,
    horizon,
  };
}
