import type { Company, Scenario, ScenarioResult } from '../data/types';
export const defaultScenarios: Scenario[] = [
  {
    id: 'negative',
    name: 'Негативный',
    color: '#ee8b91',
    growthSBER: -15,
    growthT: -20,
    peSBER: 3,
    peT: 4,
    payoutSBER: 35,
    payoutT: 15,
    premise: 'Замедление прибыли, высокая ставка и сжатие рыночной оценки.',
    risk: 'Кредитные потери и новые ограничения могут усилить снижение.',
  },
  {
    id: 'base',
    name: 'Базовый',
    color: '#78a0ff',
    growthSBER: 8,
    growthT: 20,
    peSBER: 4,
    peT: 5,
    payoutSBER: 50,
    payoutT: 25,
    premise: 'Умеренный рост бизнеса и сохранение дивидендных возможностей.',
    risk: 'Рост резервов, изменение налогов и разовые доходы 2025 года.',
  },
  {
    id: 'positive',
    name: 'Позитивный',
    color: '#40cbb0',
    growthSBER: 15,
    growthT: 35,
    peSBER: 5,
    peT: 7,
    payoutSBER: 50,
    payoutT: 30,
    premise: 'Ускорение прибыли и повышение мультипликаторов при улучшении конъюнктуры.',
    risk: 'Снижение ставки и интеграционный эффект могут не реализоваться.',
  },
];
export function valuation(eps: number, price: number, growth: number, pe: number, payout: number) {
  if (
    ![eps, price, growth, pe, payout].every(Number.isFinite) ||
    eps <= 0 ||
    price <= 0 ||
    growth <= -100 ||
    pe <= 0 ||
    payout < 0 ||
    payout > 100
  )
    throw new Error('Некорректные допущения сценария');
  const forecastEps = eps * (1 + growth / 100),
    target = forecastEps * pe,
    dividend = (forecastEps * payout) / 100;
  return { eps: forecastEps, price: target, dividend, return: (target - price + dividend) / price };
}
export function scenarioResult(
  s: Scenario,
  eps: Record<Company, number>,
  prices: Record<Company, number>,
  weight: number,
  amount: number,
): ScenarioResult {
  if (!Number.isFinite(weight + amount) || weight < 0 || weight > 1 || amount < 0)
    throw new Error('Некорректный портфель');
  const a = valuation(eps.SBER, prices.SBER, s.growthSBER, s.peSBER, s.payoutSBER),
    b = valuation(eps.T, prices.T, s.growthT, s.peT, s.payoutT);
  const r = weight * a.return + (1 - weight) * b.return;
  return {
    id: s.id,
    name: s.name,
    color: s.color,
    SBER: a,
    T: b,
    return: r,
    value: amount * (1 + r),
    profit: amount * r,
  };
}
