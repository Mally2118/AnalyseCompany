import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  cagr,
  compound,
  correlation,
  covariance,
  drawdowns,
  growth,
  maxDrawdown,
  mean,
  quantile,
  stdev,
  variance,
} from '../src/calculations/statistics';
import {
  monthlyReturns,
  paired,
  periodicReturn,
  splitAdjusted,
  statistics,
  wealthSeries,
} from '../src/calculations/market';
import { frontier, portfolioReturns, portfolioRisk } from '../src/calculations/portfolio';
import { defaultScenarios, scenarioResult, valuation } from '../src/calculations/scenarios';
import { validateFinancial, validateMarket } from '../src/services/validation';
import { balanceROA, comparableCagr } from '../src/calculations/financial';
import { fact, stability } from '../src/calculations/analysis';
import { fmt, pct } from '../src/utils/format';
const load = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'));
const financial = validateFinancial(load('financial')),
  market = validateMarket(load('market'));
describe('Выборочная статистика и доходность', () => {
  it('использует дивиденд в числителе, нулевую и неполную цену не подменяет', () => {
    expect(periodicReturn(100, 110, 5)).toBeCloseTo(0.15);
    expect(periodicReturn(null, 100)).toBeNull();
    expect(periodicReturn(100, null)).toBeNull();
    expect(periodicReturn(100, 110, null)).toBeNull();
    expect(() => periodicReturn(0, 100)).toThrow();
    expect(() => periodicReturn(100, -1)).toThrow();
  });
  it('считает дисперсию и ковариацию с n−1', () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(variance([1, 2, 3])).toBe(1);
    expect(covariance([1, 2, 3], [2, 4, 6])).toBe(2);
    expect(correlation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1);
    expect(correlation([1, 1], [2, 3])).toBeNull();
    expect(() => covariance([1, 2], [1])).toThrow();
    expect(() => mean([NaN])).toThrow();
  });
  it('различает арифметическую, геометрическую и годовую волатильность', () => {
    const s = statistics([0.1, -0.1], 0.1, [
      { date: '2020-12-31', value: 1 },
      { date: '2021-12-31', value: 0.99 },
    ])!;
    expect(s.annualMean).toBe(0);
    expect(s.annualVol).toBeCloseTo(Math.sqrt(0.02) * Math.sqrt(12));
    expect(s.cagr).toBeLessThan(0);
    expect(s.sharpe).toBeCloseTo((-(1.1 ** (1 / 12) - 1) / Math.sqrt(0.02)) * Math.sqrt(12));
    expect(s.var95).toBeNull();
  });
  it('использует дневной пик в просадке', () => {
    expect(drawdowns([100, 120, 90, 110])).toEqual([0, 0, -0.25, 110 / 120 - 1]);
    expect(maxDrawdown([100, 120, 90, 110])).toBe(-0.25);
    expect(maxDrawdown([])).toBeNull();
    expect(() => drawdowns([100, 0])).toThrow();
  });
  it('интерполирует исторический VaR, не возвращает ожидаемый предел убытка', () => {
    expect(quantile([-0.2, -0.1, 0, 0.1, 0.2], 0.05)).toBeCloseTo(-0.18);
    expect(() => quantile([], 0.05)).toThrow();
  });
  it('обрабатывает неприменимый CAGR и сложный процент', () => {
    expect(cagr(100, 121, 2)).toBeCloseTo(0.1);
    expect(cagr(0, 10, 2)).toBeNull();
    expect(cagr(100, -1, 2)).toBeNull();
    expect(growth(0, 10)).toBeNull();
    expect(compound(100, 0.1, 2)).toBeCloseTo(121);
    expect(() => compound(100, -1, 2)).toThrow();
  });
});
describe('Марковиц и Sharpe', () => {
  const a = [0.01, -0.03, 0.05, 0.08, -0.02],
    b = [-0.02, 0.05, 0.03, -0.01, 0.06];
  it('формула дисперсии совпадает с дисперсией взвешенных фактических доходностей', () => {
    for (const w of [0, 0.2, 0.5, 0.9, 1])
      expect(portfolioRisk(w, variance(a), variance(b), covariance(a, b))).toBeCloseTo(
        stdev(portfolioReturns(a, b, w)),
        12,
      );
  });
  it('находит глобальные экстремумы сетки, а не заранее заданные веса', () => {
    const m = frontier(a, b, 0.1);
    expect(m.points).toHaveLength(101);
    expect(m.min.risk).toBe(Math.min(...m.points.map((p) => p.risk)));
    expect(m.max.sharpe).toBe(Math.max(...m.points.map((p) => p.sharpe!)));
    expect(m.min.weight).toBeGreaterThan(0);
    expect(m.min.weight).toBeLessThan(1);
    expect(m.points[0].risk).toBeCloseTo(stdev(b) * Math.sqrt(12));
  });
  it('определяет эффективный участок по доминированию', () => {
    const m = frontier(a, b, 0.1);
    for (const p of m.points.filter((p) => p.efficient))
      expect(m.points.some((q) => q.risk < p.risk - 1e-10 && q.mean >= p.mean)).toBe(false);
    expect(m.min.efficient).toBe(true);
  });
  it('безрисковая ставка и вес согласованы по периодам', () => {
    const m = frontier(a, b, 0.2),
      p = m.points[37],
      monthly = portfolioReturns(a, b, 0.37);
    expect(p.sharpe).toBeCloseTo(
      ((mean(monthly) - (1.2 ** (1 / 12) - 1)) / stdev(monthly)) * Math.sqrt(12),
    );
    expect(() => portfolioRisk(-0.1, 0.1, 0.1, 0)).toThrow();
    expect(() => portfolioRisk(0.5, 0.1, 0.1, 0.2)).toThrow();
    expect(() => frontier(a, b, -1)).toThrow();
  });
  it('возвращает null Sharpe при нулевой волатильности', () => {
    const m = frontier([0.01, 0.01], [0.02, 0.02], 0.1);
    expect(m.points.every((p) => p.sharpe === null)).toBe(true);
  });
});
describe('Корпоративные действия и реальная история', () => {
  it('проверяет масштаб T до и после сплита без искусственного убытка 90%', () => {
    expect(splitAdjusted(3280, 10)).toBe(328);
    expect(periodicReturn(splitAdjusted(3280, 10), 328)).toBe(0);
    expect(market.audit.maxRatioError).toBeLessThan(1e-6);
    expect(market.audit.overlap).toBeGreaterThan(500);
    const first = market.monthly[0];
    expect(first.T).toBeCloseTo(236.04);
    expect(first.tOriginal).toBeCloseTo(2360.4);
  });
  it('не превращает приостановку торгов в нулевую доходность или двухмесячную в месячную', () => {
    const rows = monthlyReturns(market, 'price');
    expect(rows.find((r) => r.date.startsWith('2024-02'))?.T).toBeNull();
    expect(rows.find((r) => r.date.startsWith('2024-03'))?.T).toBeNull();
    expect(paired(rows).rows).toHaveLength(58);
    expect(rows.filter((r) => r.T !== null).every((r) => r.SBER !== null)).toBe(true);
  });
  it('реинвестирует дивиденды на уровне ежедневной позиции', () => {
    const prices = wealthSeries(market, 'SBER', 'price'),
      total = wealthSeries(market, 'SBER', 'total');
    const day = market.dividends.find((d) => d.company === 'SBER')!,
      index = market.quotes.findIndex((q) => q.date === day.date),
      p = market.quotes[index].SBER!;
    const relative =
      total[index].value! /
      prices[index].value! /
      (total[index - 1].value! / prices[index - 1].value!);
    expect(relative).toBeCloseTo(1 + day.amount / p, 10);
    expect(total.at(-1)!.value).toBeGreaterThan(prices.at(-1)!.value!);
  });
  it('оставляет T total 2021 неизвестным и не теряет базу в декабре 2021', () => {
    const w = wealthSeries(market, 'T', 'total');
    expect(w.filter((r) => r.date < '2021-12-30').every((r) => r.value === null)).toBe(true);
    const rows = monthlyReturns(market, 'total');
    expect(rows.find((r) => r.date.startsWith('2021-06'))?.T).toBeNull();
    expect(rows.find((r) => r.date.startsWith('2022-01'))?.T).not.toBeNull();
    expect(paired(rows).rows).toHaveLength(46);
  });
  it('подтвержденные цены T неизменны на переходе тикера, а не склеены вручную', () => {
    const rows = market.quotes.filter((q) => q.date >= '2024-11-25' && q.date <= '2024-12-02');
    for (const q of rows) if (q.T && q.tOriginal) expect(q.tOriginal / q.T).toBeCloseTo(10);
  });
});
describe('Сценарии и качество данных', () => {
  it('проверяет EPS, P/E, дивиденд и финансовый результат', () => {
    expect(valuation(10, 100, 20, 10, 50)).toEqual({
      eps: 12,
      price: 120,
      dividend: 6,
      return: 0.26,
    });
    const r = scenarioResult(
      defaultScenarios[1],
      { SBER: 10, T: 20 },
      { SBER: 100, T: 200 },
      0.3,
      100000,
    );
    expect(r.return).toBeCloseTo(0.3 * r.SBER.return + 0.7 * r.T.return);
    expect(r.value - r.profit).toBeCloseTo(100000);
    expect(() => valuation(10, 0, 20, 10, 50)).toThrow();
    expect(() => valuation(10, 100, -100, 10, 50)).toThrow();
  });
  it('меняет результат при изменении предпосылок', () => {
    const eps = { SBER: 77.81, T: 68.872 },
      prices = { SBER: 299.9, T: 328 };
    const a = scenarioResult(defaultScenarios[1], eps, prices, 0.5, 100000),
      b = scenarioResult({ ...defaultScenarios[1], growthT: 50 }, eps, prices, 0.5, 100000);
    expect(b.T.price).toBeGreaterThan(a.T.price);
    expect(b.value).toBeGreaterThan(a.value);
  });
  it('сохраняет null и подпись «Нет данных»', () => {
    expect(fmt(null)).toBe('Нет данных');
    expect(pct(null)).toBe('Нет данных');
    expect(financial.facts.some((f) => f.value === null)).toBe(true);
    expect(fact(financial, 'SBER', 2021, 'roa')).toBeNull();
  });
  it('отклоняет неподтвержденные источники, дубликаты и нечисловые значения', () => {
    const copy = structuredClone(financial);
    copy.facts[0].sourceId = 'invented';
    expect(() => validateFinancial(copy)).toThrow();
    const copy2 = structuredClone(market);
    copy2.monthly[1].T = -3;
    expect(() => validateMarket(copy2)).toThrow();
    const units = structuredClone(financial);
    units.facts[0].unit = '%';
    expect(() => validateFinancial(units)).toThrow();
    const copy3 = structuredClone(financial);
    copy3.facts.push(copy3.facts[0]);
    expect(() => validateFinancial(copy3)).toThrow();
  });
  it('использует реальную прибыль группы, а не операционную прибыль акционеров', () => {
    expect(fact(financial, 'T', 2025, 'profit')).toBe(192.414);
    expect(fact(financial, 'T', 2025, 'eps')).toBe(68.872);
    expect(fact(financial, 'SBER', 2022, 'profit')).toBe(287.8);
  });
  it('отделяет пропуски от неблагоприятной динамики эмитента', () => {
    const d = structuredClone(financial);
    d.facts.find((f) => f.company === 'SBER' && f.year === 2025 && f.metric === 'equity')!.value =
      null;
    expect(stability(d, 'SBER').category).toBe('Недостаточно информации для оценки');
    const bad = structuredClone(financial);
    bad.facts
      .filter((f) => f.company === 'T' && f.year === 2025 && f.metric === 'profit')
      .forEach((f) => (f.value = -1));
    expect(stability(bad, 'T').category).toBe('Неблагоприятная динамика');
  });
});

describe('Показатели на годовом балансе', () => {
  it('расчетная ROA не подменяет отсутствующую раскрытую ROA', () => {
    expect(balanceROA(financial, 'SBER', 2025)).toBeCloseTo(
      (1705.9 / ((60855.1 + 68814.5) / 2)) * 100,
    );
    expect(fact(financial, 'SBER', 2025, 'roa')).toBeNull();
    expect(balanceROA(financial, 'SBER', 2021)).toBeNull();
  });
  it('не показывает CAGR для несопоставимого ряда с M&A или пропусками', () => {
    expect(comparableCagr(financial, 'T', 'profit')).toBeNull();
    expect(comparableCagr(financial, 'SBER', 'profit')).toBeCloseTo((1705.9 / 1245.9) ** 0.25 - 1);
    expect(comparableCagr(financial, 'SBER', 'roa')).toBeNull();
  });
});
