import type { Company, FinancialData, MarketData, Scenario, ScenarioResult } from '../data/types';
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
    growthSBER: 5,
    growthT: 5,
    peSBER: 299.9 / 77.81,
    peT: 328 / 68.872,
    payoutSBER: 50,
    payoutT: 25,
    premise:
      'Нейтральная учебная база: рост EPS 5% у обеих групп, P/E равен ретроспективному значению на 30.12.2025; переоценки нет. Выплаты 50% / 25% — допущение, не обещание.',
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
    premise:
      'Оптимистичный учебный стресс-тест: EPS Сбера +15% → +8%, Т +35% → +15%, P/E 5 / 7. Это редактируемые учебные допущения, а не оценённый прогноз.',
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

export const scenarioMethodology =
  'Пять годовых наблюдений не дают надёжного прогноза EPS. Базовые 5% — одинаковый условный номинальный рост, не оценка по регрессии. P/E базы = цена 30.12.2025 / базовая EPS 2025: Сбер 299,90 / 77,81; Т 328 / 68,872. EPS 2025 опубликована позже даты цены. Росбанк (2024) и разовые эффекты 2025 ограничивают сопоставимость прибыли Т: исторический темп роста не экстраполируется в базу. При этом исходная EPS 2025 не нормализована: сохранение её уровня, включая возможные разовые эффекты, — отдельное ограничение базового сценария, а не прогноз регулярной прибыли. Негативный и позитивный сценарии — условные стресс-тесты; более высокий рост Т в позитивном сценарии задан пользователем модели, а не доказан данными. Доли выплат не гарантированы. Эконометрическое восстановление котировок не обосновывает будущий рост EPS и не меняет сценарные параметры. После первого года P/E постоянен; рост EPS плавно приходит к долгосрочному допущению к пятому году. Переоценка не начисляется повторно.';

/** Refresh the neutral baseline from the same validated data used by the research model. */
export function scenariosForData(financial: FinancialData, market: MarketData): Scenario[] {
  const scenarios = structuredClone(defaultScenarios);
  const base = scenarios.find((s) => s.id === 'base')!;
  for (const company of ['SBER', 'T'] as const) {
    const eps = financial.facts.find(
      (f) => f.company === company && f.year === 2025 && f.metric === 'eps',
    )?.value;
    const price = market.monthly.at(-1)?.[company];
    if (eps != null && eps > 0 && price != null && price > 0)
      base[company === 'SBER' ? 'peSBER' : 'peT'] = price / eps;
  }
  return scenarios;
}
