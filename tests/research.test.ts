import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateFinancial, validateMarket } from '../src/services/validation';
import { createResearchModel, marketResearch } from '../src/calculations/research';
import { analysisPeriod, elapsedYears } from '../src/calculations/period';
import { cagr, covariance, stdev, mean } from '../src/calculations/statistics';
import { defaultScenarios, valuation } from '../src/calculations/scenarios';
import { historicalValuations, priceEarnings } from '../src/calculations/valuation';
import { allocation, investmentLimits } from '../src/calculations/calculator';
import { financialCSVRows } from '../src/utils/export';
import { portfolioWealth } from '../src/calculations/portfolio';
const load = (n: string): unknown =>
  JSON.parse(readFileSync(new URL(`../public/data/${n}.json`, import.meta.url), 'utf8'));
const data = {
  financial: validateFinancial(load('financial')),
  market: validateMarket(load('market')),
};
const model = (kind: 'price' | 'total', start = 2021, weight = 0.5, amount = 100000) =>
  createResearchModel(data, kind, start, 0.1, weight, amount, defaultScenarios);
describe('Одинаковая база ценовой и полной доходности', () => {
  it('не считает базовый декабрь отдельным годом и использует календарные дни', () => {
    expect(cagr(100, 100, elapsedYears('2020-12-30', '2025-12-30'))).toBe(0);
    expect(cagr(100, 120, 5)).toBeGreaterThan(0);
    expect(cagr(100, 80, 5)).toBeLessThan(0);
    const p = analysisPeriod(data.market, 2021);
    expect(p.requestedStart).toBe('2020-12-30');
    expect(p.from).toBe('2021-12-30');
    expect(p.years).toBe(4);
    expect(p.limited).toBe(true);
    const short = analysisPeriod(data.market, 2023);
    expect(short.years).toBeCloseTo(1096 / 365.25, 12);
    expect(short.limited).toBe(false);
  });
  for (const start of [2021, 2023])
    for (const c of ['SBER', 'T'] as const)
      it(`полная стоимость ${c}, период ${start}, не ниже ценовой ни на одной общей дате`, () => {
        const price = marketResearch(data, 'price', start, 0.1),
          total = marketResearch(data, 'total', start, 0.1);
        expect(price.period).toEqual(total.period);
        expect(price.pair.rows.map((r) => r.date)).toEqual(total.pair.rows.map((r) => r.date));
        expect(price.wealth[c][0].value).toBeCloseTo(1, 12);
        expect(total.wealth[c][0].value).toBeCloseTo(1, 12);
        const prices = new Map(price.wealth[c].map((q) => [q.date, q.value]));
        for (const q of total.wealth[c])
          if (q.value !== null && prices.get(q.date) !== null)
            expect(q.value + 1e-12).toBeGreaterThanOrEqual(prices.get(q.date)!);
        expect(total.stats[c]!.cagr!).toBeGreaterThan(price.stats[c]!.cagr!);
        expect(total.stats[c]!.from).toBe(price.stats[c]!.from);
        expect(total.stats[c]!.till).toBe(price.stats[c]!.till);
      });
  it('не выдаёт четыре года за пятилетний дивидендный CAGR', () => {
    const m = model('total');
    expect(m.period.limited).toBe(true);
    expect(m.fiveYear.T.total).toBeNull();
    expect(m.fiveYearPortfolio).toBeNull();
    expect(m.fiveYear.T.price?.cagr).toBeCloseTo(0.068025348, 8);
    expect(m.comparison.T.price?.cagr).toBeCloseTo(-0.144310716955, 10);
    expect(m.comparison.T.total?.cagr).toBeCloseTo(-0.12906082625, 10);
  });
  it('не начисляет дивиденд второй раз и не вводит повторное деление цены T на 10', () => {
    const p = model('price'),
      t = model('total'),
      lastPrice = p.wealth.T.filter((q) => q.value !== null).at(-1)!.value!,
      lastTotal = t.wealth.T.filter((q) => q.value !== null).at(-1)!.value!;
    const multiplier = data.market.dividends
      .filter((d) => d.company === 'T' && d.date > p.period.from && d.date <= p.period.till)
      .reduce(
        (product, d) =>
          product * (1 + d.amount / data.market.quotes.find((q) => q.date === d.date)!.T!),
        1,
      );
    expect(lastTotal / lastPrice).toBeCloseTo(multiplier, 12);
    expect(data.market.monthly.at(-1)!.T).toBe(328);
  });
});
describe('Аудит Марковица и фактический портфельный CAGR', () => {
  it('ребалансирует дневную стоимость только в заданные даты: независимый численный пример', () => {
    const dates = ['2025-01-01', '2025-01-31', '2025-02-28'];
    const a = [1, 2, 1].map((value, i) => ({ date: dates[i], value }));
    const b = [1, 1, 2].map((value, i) => ({ date: dates[i], value }));
    expect(portfolioWealth(a, b, 0.5, [dates[1]]).map((q) => q.value)).toEqual([1, 1.5, 1.875]);
    expect(portfolioWealth(a, b, 0.5, []).map((q) => q.value)).toEqual([1, 1.5, 1.5]);
  });
  for (const kind of ['price', 'total'] as const)
    for (const start of [2021, 2023])
      it(`крайние веса совпадают с активами на общей выборке: ${kind}, ${start}`, () => {
        const m = model(kind, start),
          f = m.model!;
        for (const [index, c] of [
          [100, 'SBER'],
          [0, 'T'],
        ] as const) {
          const point = f.points[index],
            s = m.stats[c]!;
          expect(point.mean).toBeCloseTo(s.annualMean, 12);
          expect(point.risk).toBeCloseTo(s.annualVol, 12);
          expect(point.sharpe).toBeCloseTo(s.sharpe!, 12);
          expect(model(kind, start, index / 100).historical.selected.cagr).toBeCloseTo(s.cagr!, 12);
        }
        for (const point of f.points) expect(point.weight + (1 - point.weight)).toBe(1);
        expect(f.min.risk).toBe(Math.min(...f.points.map((p) => p.risk)));
        expect(f.max.sharpe).toBe(Math.max(...f.points.map((p) => p.sharpe!)));
        expect(f.covariance[0][1]).toBeCloseTo(covariance(m.pair.SBER, m.pair.T) * 12, 12);
      });
  it('сохраняет корректные 27,54% и 38,83% как арифметические, не геометрические оценки', () => {
    const p = model('price', 2023, 1),
      t = model('total', 2023, 1);
    expect(p.selected?.mean).toBeCloseTo(0.275381183326, 10);
    expect(t.selected?.mean).toBeCloseTo(0.388297030606, 10);
    expect(p.historical.selected.cagr).toBeCloseTo(0.28550462102, 10);
    expect(t.historical.selected.cagr).toBeCloseTo(0.428724353809, 10);
    expect(p.fiveYearPortfolio?.annualMean).toBeCloseTo(0.083818265155, 10);
    expect(t.fiveYearPortfolio?.annualMean).toBeCloseTo(0.16338253608, 10);
  });
  it('пересчитывает выборку, риск, ковариацию и оптимум; пропуски не заполняются', () => {
    const long = model('price'),
      short = model('price', 2023),
      total = model('total');
    expect(long.pair.rows).toHaveLength(46);
    expect(short.pair.rows).toHaveLength(34);
    expect(long.model?.min.weight).not.toBe(short.model?.min.weight);
    expect(long.model?.covariance).not.toEqual(total.model?.covariance);
    expect(long.correlation).not.toBe(total.correlation);
    expect(long.rows.find((r) => r.date.startsWith('2024-02'))?.T).toBeNull();
    expect(long.rows.find((r) => r.date.startsWith('2024-03'))?.SBER).toBeNull();
    expect(long.pair.SBER.some((r) => r < -0.4)).toBe(true);
    const sd = stdev(total.pair.SBER),
      rf = 1.1 ** (1 / 12) - 1;
    expect(total.model!.points[100].sharpe).toBeCloseTo(
      ((mean(total.pair.SBER) - rf) / sd) * Math.sqrt(12),
      12,
    );
  });
  it('исторический дневной портфель не теряет ценовое движение через отсутствующий месяц', () => {
    const m = model('price', 2023, 0.3),
      nav = m.historical.selected.series;
    expect(nav.find((q) => q.date === '2024-03-18')?.value).not.toBeNull();
    expect(nav[0].value).toBe(1);
    expect(nav.at(-1)?.date).toBe(m.period.till);
    expect(m.historical.selected.cagr).toBeCloseTo(
      cagr(1, nav.at(-1)!.value!, m.period.years)!,
      12,
    );
  });
});
describe('P/E на подтвержденной базе акций', () => {
  it('делит цену на базовую EPS и отвергает отсутствующую, нулевую, отрицательную прибыль', () => {
    expect(priceEarnings(120, 10)).toBe(12);
    for (const eps of [null, 0, -10, NaN]) expect(priceEarnings(120, eps)).toBeNull();
    expect(priceEarnings(null, 10)).toBeNull();
    expect(priceEarnings(-100, 10)).toBeNull();
  });
  it('корректировка обеих величин на сплит не меняет P/E', () => {
    expect(priceEarnings(3280, 688.72)).toBeCloseTo(priceEarnings(328, 68.872)!, 12);
  });
  it('не выдумывает EPS T за 2022–2023; сохраняет источники и ретроспективную маркировку', () => {
    const pe = historicalValuations(data.financial, data.market);
    expect(pe).toHaveLength(10);
    for (const v of pe) {
      expect(v.note).toContain('Ретроспективный');
      expect(v.priceUrl).toContain('iss.moex.com');
      if (v.company === 'T' && [2022, 2023].includes(v.year)) expect(v.pe).toBeNull();
    }
    expect(pe.find((v) => v.company === 'T' && v.year === 2025)?.pe).toBeCloseTo(328 / 68.872, 12);
  });
  it('сценарная цена и P/E согласованы при изменении мультипликатора', () => {
    const a = valuation(68.872, 328, 20, 5, 25),
      b = valuation(68.872, 328, 20, 6, 25);
    expect(priceEarnings(a.price, a.eps)).toBeCloseTo(5);
    expect(b.price / a.price).toBeCloseTo(6 / 5);
    expect(b.dividend).toBe(a.dividend);
  });
  it('CSV содержит производный P/E, источники и оговорку', () => {
    const m = model('price'),
      rows = financialCSVRows({
        data,
        model: m,
        kind: 'price',
        start: 2021,
        rf: 0.1,
        weight: 0.5,
        amount: 100000,
        scenarios: defaultScenarios,
        horizon: 1,
      });
    expect(rows.filter((r) => r[2] === 'P/E ретроспективный')).toHaveLength(10);
  });
});
describe('Сумма и веса — единый источник результатов', () => {
  it('сохраняет точный ручной ввод и сумму двух частей', () => {
    expect(investmentLimits).toEqual({ min: 10000, max: 1000000, step: 10000, initial: 100000 });
    for (const amount of [10000, 123456, 1000000])
      for (const w of [0, 0.13, 0.5, 1]) {
        const a = allocation(amount, w);
        expect(a.SBER + a.T).toBe(amount);
      }
  });
  it('удвоение капитала удваивает все суммы, не меняя доходности и риска', () => {
    const a = model('total', 2023, 0.37, 100000),
      b = model('total', 2023, 0.37, 200000);
    for (let i = 0; i < a.results.length; i++) {
      expect(b.results[i].profit).toBeCloseTo(a.results[i].profit * 2);
      expect(b.results[i].value).toBeCloseTo(a.results[i].value * 2);
      expect(b.results[i].return).toBe(a.results[i].return);
    }
    expect(b.selected).toEqual(a.selected);
    expect(b.conclusions.at(-1)).toContain('200');
    expect(b.conclusions.at(-1)).not.toBe(a.conclusions.at(-1));
  });
});
