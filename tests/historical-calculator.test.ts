import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cagr } from '../src/calculations/statistics';
import { historicalCalculation } from '../src/calculations/calculator';
import { createResearchModel } from '../src/calculations/research';
import { defaultScenarios, scenariosForData } from '../src/calculations/scenarios';
import { validateFinancial, validateMarket } from '../src/services/validation';
const read = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'));
const data = {
  financial: validateFinancial(read('financial')),
  market: validateMarket(read('market')),
};
const model = (weight: number, kind: 'price' | 'total' = 'price', start = 2021, amount = 500000) =>
  createResearchModel(data, kind, start, 0.1, weight, amount, defaultScenarios, 5);
describe('Исторический режим — геометрический темп стоимости всего портфеля', () => {
  it.each([
    [100, 121, 2, 0.1],
    [100, 100, 5, 0],
    [100, 81, 2, -0.1],
  ])('CAGR %s → %s за %s лет', (start, end, n, expected) => {
    expect(cagr(start, end, n)).toBeCloseTo(expected, 12);
  });
  it('отрицательные 14,43% преобразуются в 0,8557 в степени, без подмены процентами', () => {
    const r = historicalCalculation(500000, -0.1443, 5)!;
    expect(r.value).toBeCloseTo(500000 * 0.8557 ** 5, 7);
    expect(r.value).toBeGreaterThan(229000);
    expect(r.value).toBeLessThan(230000);
    expect(r.profit).toBeLessThan(0);
    expect(r.path[0].value).toBe(500000);
    expect(r.path.at(-1)!.value).toBe(r.value);
    expect(cagr(500000, r.value, 5)).toBeCloseTo(r.cagr, 12);
  });
  it('при любом допустимом горизонте более высокий CAGR означает больший капитал', () => {
    for (const n of [1, 2, 5, 10]) {
      expect(historicalCalculation(500000, 0.02, n)!.value).toBeGreaterThan(
        historicalCalculation(500000, -0.14, n)!.value,
      );
      expect(historicalCalculation(500000, 0, n)!.value).toBe(500000);
    }
  });
  it('сохраняет пропуск CAGR и отклоняет некорректные параметры', () => {
    expect(historicalCalculation(500000, null, 5)).toBeNull();
    for (const rate of [NaN, Infinity, -1, -14.43])
      expect(() => historicalCalculation(500000, rate, 5)).toThrow();
    for (const n of [0, 1.5, 11, NaN])
      expect(() => historicalCalculation(500000, 0.1, n)).toThrow();
    expect(() => historicalCalculation(0, 0.1, 5)).toThrow();
  });
  for (const kind of ['price', 'total'] as const) {
    it(`100% позиции совпадают с CAGR отдельных активов на общих датах: ${kind}`, () => {
      for (const [w, c] of [
        [1, 'SBER'],
        [0, 'T'],
      ] as const) {
        const m = model(w, kind);
        expect(m.calculatorMode).toBe('history');
        expect(m.historyCalculation!.cagr).toBeCloseTo(m.stats[c]!.cagr!, 12);
        expect(m.historyCalculation!.value).toBeCloseTo(500000 * (1 + m.stats[c]!.cagr!) ** 5, 7);
        expect(m.period.from).toBe('2021-12-30');
        expect(m.period.till).toBe('2025-12-30');
      }
      expect(model(1, kind).historyCalculation!.value).toBeGreaterThan(
        model(0, kind).historyCalculation!.value,
      );
    });
  }
  it('смешанный портфель использует реальный NAV, а не взвешенные CAGR', () => {
    const m = model(0.37),
      series = m.historical.selected.series;
    const rate = cagr(series[0].value!, series.at(-1)!.value!, m.period.years)!;
    expect(m.historyCalculation!.cagr).toBeCloseTo(rate, 12);
    expect(Math.abs(rate - (0.37 * m.stats.SBER!.cagr! + 0.63 * m.stats.T!.cagr!))).toBeGreaterThan(
      0.001,
    );
  });
  it('даты, дивиденды, вес и сумма пересчитывают график и результат вместе', () => {
    const price = model(0),
      total = model(0, 'total'),
      shorter = model(0, 'price', 2023),
      twice = model(0, 'price', 2021, 1000000);
    expect(total.historyCalculation!.value).toBeGreaterThan(price.historyCalculation!.value);
    expect(shorter.historyCalculation!.cagr).not.toBe(price.historyCalculation!.cagr);
    expect(shorter.historyCalculation!.value).not.toBe(price.historyCalculation!.value);
    expect(model(0.5).historyCalculation!.value).not.toBe(price.historyCalculation!.value);
    expect(twice.historyCalculation!.value).toBeCloseTo(2 * price.historyCalculation!.value, 8);
    expect(twice.historyCalculation!.cagr).toBe(price.historyCalculation!.cagr);
    for (const m of [price, total, shorter, twice])
      expect(m.historyCalculation!.path.at(-1)!.value).toBe(m.historyCalculation!.value);
  });
  it('база сохраняет исторический P/E и одинаковый условный рост 5%, а не разовые эффекты Т', () => {
    const m = model(0.5),
      base = m.projections.find((p) => p.id === 'base')!;
    for (const c of ['SBER', 'T'] as const) {
      const pe = m.valuations.find((p) => p.company === c && p.year === 2025)!.pe!;
      for (const q of base.path.slice(1)) {
        expect(q[c].growth).toBe(5);
        expect(q[c].pe).toBeCloseTo(pe, 12);
      }
      expect(base.path[1][c].price / base.path[0][c].price).toBeCloseTo(1.05, 12);
    }
  });
});

it('нейтральный P/E берётся из загруженных данных, пересчитывается при обновлении и сбросе', () => {
  const changed = structuredClone(data);
  changed.market.monthly.at(-1)!.T = 400;
  const base = scenariosForData(changed.financial, changed.market).find((s) => s.id === 'base')!;
  expect(base.peT).toBeCloseTo(400 / 68.872, 12);
  expect(base.growthT).toBe(5);
  expect(base.growthSBER).toBe(5);
  expect(defaultScenarios.find((s) => s.id === 'base')!.peT).toBeCloseTo(328 / 68.872, 12);
});
