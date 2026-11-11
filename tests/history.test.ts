import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Quote } from '../src/data/types';
import { historyData } from '../src/charts/history';
import { marketResearch, createResearchModel } from '../src/calculations/research';
import { defaultScenarios } from '../src/calculations/scenarios';
import { validateFinancial, validateMarket } from '../src/services/validation';

const load = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'));
const data = {
  financial: validateFinancial(load('financial')),
  market: validateMarket(load('market')),
};
const research = (kind: 'price' | 'total', start: number) => marketResearch(data, kind, start, 0.1);
const emptyWealth = { SBER: [], T: [] };

describe('Индекс стоимости и фактическая цена акции', () => {
  for (const start of [2021, 2023])
    for (const kind of ['price', 'total'] as const)
      it(`индекс начинается со 100 на фактической базе модели: ${start}, ${kind}`, () => {
        const model = research(kind, start),
          rows = historyData(data.market, model.wealth, model.period, 'index');
        expect(rows[0].date).toBe(start === 2021 ? '2021-12-30' : '2022-12-30');
        for (const company of ['SBER', 'T'] as const)
          expect(rows.find((q) => q[company] !== null)![company]).toBeCloseTo(100, 12);

        if (kind === 'price') {
          const firstQuote = data.market.quotes.find((q) => q.date === model.period.from)!,
            lastQuote = data.market.quotes.find((q) => q.date === model.period.till)!;
          for (const company of ['SBER', 'T'] as const)
            expect(rows.at(-1)![company]).toBeCloseTo(
              (lastQuote[company]! / firstQuote[company]!) * 100,
              10,
            );
        }
      });

  it('показывает одинаковые исходные цены на всех общих датах обоих периодов', () => {
    const long = research('price', 2021),
      short = research('price', 2023),
      longPrices = historyData(data.market, long.wealth, long.period, 'price'),
      shortPrices = historyData(data.market, short.wealth, short.period, 'price'),
      byDate = new Map(longPrices.map((q) => [q.date, q]));
    expect(longPrices[0].date).toBe('2020-12-30');
    expect(shortPrices[0].date).toBe('2022-12-30');
    for (const row of shortPrices) expect(row).toEqual(byDate.get(row.date));
    for (const rows of [longPrices, shortPrices])
      expect(rows.at(-1)).toEqual({ date: '2025-12-30', SBER: 299.9, T: 328 });
  });

  for (const start of [2021, 2023])
    it(`настройка дивидендов меняет индекс, но не фактическую цену: ${start}`, () => {
      const price = research('price', start),
        total = research('total', start);
      expect(historyData(data.market, price.wealth, price.period, 'price')).toEqual(
        historyData(data.market, total.wealth, total.period, 'price'),
      );
      const priceIndex = historyData(data.market, price.wealth, price.period, 'index'),
        totalIndex = historyData(data.market, total.wealth, total.period, 'index');
      for (const company of ['SBER', 'T'] as const)
        expect(totalIndex.at(-1)![company]).toBeGreaterThan(priceIndex.at(-1)![company]!);
    });

  it('сохраняет все дневные даты, исходные пропуски и последнюю цену без прореживания', () => {
    const model = research('total', 2021),
      rows = historyData(data.market, model.wealth, model.period, 'price'),
      quotes = data.market.quotes.filter((q) => q.date >= '2020-12-30');
    expect(rows.map((q) => q.date)).toEqual(quotes.map((q) => q.date));
    for (const [i, quote] of quotes.entries())
      for (const company of ['SBER', 'T'] as const) expect(rows[i][company]).toBe(quote[company]);
    expect(quotes.some((q) => q.SBER === null || q.T === null)).toBe(true);
    expect(rows.some((q) => q.SBER === 0 || q.T === 0)).toBe(false);
    expect(rows.at(-1)?.date).toBe(data.market.till);
  });

  it('объединяет даты индексов и сохраняет разрыв даже между соседними ненулевыми значениями', () => {
    const rows = historyData(
      data.market,
      {
        SBER: [
          { date: '2025-01-02', value: 1 },
          { date: '2025-01-03', value: null },
          { date: '2025-01-04', value: 1.2 },
        ],
        T: [
          { date: '2025-01-03', value: 1 },
          { date: '2025-01-04', value: null },
          { date: '2025-01-05', value: 1.5 },
        ],
      },
      { requestedStart: '2025-01-02', till: '2025-01-05' },
      'index',
    );
    expect(rows).toEqual([
      { date: '2025-01-02', SBER: 100, T: null },
      { date: '2025-01-03', SBER: null, T: 100 },
      { date: '2025-01-04', SBER: 120, T: null },
      { date: '2025-01-05', SBER: null, T: 150 },
    ]);
  });

  it('не делит скорректированные цены T повторно и не подставляет tOriginal', () => {
    const model = research('price', 2021),
      rows = historyData(data.market, model.wealth, model.period, 'price'),
      quotes = new Map(data.market.quotes.map((q) => [q.date, q]));
    for (const row of rows) {
      const quote = quotes.get(row.date)!;
      expect(row.T).toBe(quote.T);
      if (quote.T !== null && quote.tOriginal !== null)
        expect(row.T).toBeCloseTo(quote.tOriginal / 10, 10);
    }
  });

  it('сохраняет непрерывность уже скорректированной цены в синтетическом примере сплита', () => {
    // Реальный сплит 2026 года находится за пределами market.json.
    const quote = (date: string, original: number): Quote => ({
      date,
      SBER: 300,
      T: 328,
      tOriginal: original,
      tInstrument: 'T',
      note: 'Скорректированный ряд, одна база цены',
    });
    const market = {
      ...data.market,
      quotes: [quote('2026-01-01', 3280), quote('2026-01-02', 328)],
    };
    expect(
      historyData(
        market,
        emptyWealth,
        { requestedStart: '2026-01-01', till: '2026-01-02' },
        'price',
      ).map((q) => q.T),
    ).toEqual([328, 328]);
  });

  it('ограничивает цену запрошенными датами и не восстанавливает отсутствующие котировки', () => {
    const market = {
      ...data.market,
      quotes: [
        { ...data.market.quotes[0], date: '2025-01-01', T: 100 },
        { ...data.market.quotes[0], date: '2025-01-02', T: null },
        { ...data.market.quotes[0], date: '2025-01-03', T: 200 },
      ],
    };
    expect(
      historyData(
        market,
        { SBER: [], T: [{ date: '2025-01-02', value: 1.5 }] },
        { requestedStart: '2025-01-02', till: '2025-01-02' },
        'price',
      ),
    ).toEqual([{ date: '2025-01-02', SBER: market.quotes[1].SBER, T: null }]);
  });

  it('переключение отображения не изменяет входные данные и финансовую модель', () => {
    const model = createResearchModel(data, 'total', 2023, 0.1, 0.37, 250000, defaultScenarios),
      snapshot = structuredClone({ data, model });
    for (const display of ['index', 'price', 'index'] as const)
      historyData(data.market, model.wealth, model.period, display);
    expect(data).toEqual(snapshot.data);
    expect(model).toEqual(snapshot.model);
  });
});
