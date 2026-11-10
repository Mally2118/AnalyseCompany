import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import { validateFinancial, validateMarket } from '../src/services/validation';
import { validateRecovery } from '../src/services/recovery';
import {
  logPriceBridge,
  returnBridge,
  researchMarket,
  recoverySensitivity,
} from '../src/calculations/recovery';
import { marketResearch, createResearchModel } from '../src/calculations/research';
import { buildWorkbook, financialCSVRows, reportHTML } from '../src/utils/export';
import { defaultScenarios } from '../src/calculations/scenarios';
const raw = (file: string) =>
  readFileSync(new URL(`../public/data/${file}.json`, import.meta.url), 'utf8');
const read = (file: string): unknown => JSON.parse(raw(file));
const hash = createHash('sha256').update(raw('market')).digest('hex');
const market = validateMarket(read('market'));
const recovery = validateRecovery(read('recovery'), market, hash);
const data = { financial: validateFinancial(read('financial')), market, recovery };
describe('Аудит и происхождение', () => {
  it('24 отсутствия TQBR — не ошибки загрузки: 19 оценок, выходные и кризис не заполняются', () => {
    expect(recovery.summary).toEqual({
      dates: 1339,
      missing: 24,
      actualRecovered: 0,
      estimated: 19,
      leftUnestimated: 5,
    });
    expect(
      recovery.observations.filter((q) => q.actualPrice === null && q.category === 'suspension'),
    ).toHaveLength(3);
    expect(
      recovery.observations.filter(
        (q) => q.actualPrice === null && q.category === 'instrument-calendar',
      ),
    ).toHaveLength(2);
    for (const q of recovery.observations.filter((q) => q.actualPrice === null)) {
      expect(q.tradable).toBe(false);
      if (!q.date.startsWith('2024')) {
        expect(q.estimatedPrice).toBeNull();
        expect(q.status).toBe('no-trading');
      }
    }
  });
  it('не меняет ни одной исходной цены и не корректирует сплит повторно', () => {
    const snapshot = JSON.stringify(market);
    const result = researchMarket(market, recovery);
    expect(JSON.stringify(market)).toBe(snapshot);
    for (const [i, q] of result.quotes.entries()) {
      expect(recovery.observations[i].actualPrice).toBe(market.quotes[i].T);
      if (market.quotes[i].T !== null) expect(q.T).toBe(market.quotes[i].T);
      expect(q.SBER).toBe(market.quotes[i].SBER);
    }
    expect(result.quotes.filter((q) => q.T === null)).toHaveLength(5);
  });
  it('отклоняет подмену факта, торговый статус и устаревший исходный набор', () => {
    const changed = structuredClone(recovery);
    changed.observations[0].actualPrice = 1;
    expect(() => validateRecovery(changed, market, hash)).toThrow('фактический');
    const tradable = structuredClone(recovery);
    tradable.observations.find((q) => q.estimatedPrice !== null)!.tradable = true;
    expect(() => validateRecovery(tradable, market, hash)).toThrow('Неторговая');
    expect(() => validateRecovery(recovery, market, '0'.repeat(64))).toThrow('устарело');
  });
});
describe('Математика восстановления и честная проверка', () => {
  it('интерполирует логарифм цены, не абсолютную цену', () => {
    expect(logPriceBridge(100, 121, 2)[0]).toBeCloseTo(110, 12);
    expect(logPriceBridge(100, 81, 2)[0]).toBeCloseTo(90, 12);
    expect(() => logPriceBridge(0, 100, 2)).toThrow();
  });
  it('условный мост совпадает с обеими границами и не имеет нулевой фиктивной траектории', () => {
    const p = returnBridge(100, 121, [0.04, -0.02, 0.08]);
    expect(p.at(-1)).toBeCloseTo(121, 10);
    expect(p[0]).not.toBe(100);
    expect(() => returnBridge(100, 121, [NaN, 0.1])).toThrow();
  });
  it('19 оценок воспроизводятся из официальных факторов, коэффициентов и правой цены', () => {
    const input = JSON.parse(raw('recovery-inputs')) as {
      index: { observations: { date: string; close: number }[] };
    };
    const factors = input.index.observations;
    const l = factors.findIndex((q) => q.date === '2024-02-15'),
      r = factors.findIndex((q) => q.date === '2024-03-18');
    const model = recovery.models.find((m) => m.method === recovery.selectedFactorModel)!;
    expect(model.method).toBe('market');
    const returns = factors
      .slice(l + 1, r + 1)
      .map(
        (q, j) =>
          model.coefficients[0] + model.coefficients[1] * Math.log(q.close / factors[l + j].close),
      );
    const path = returnBridge(305.7, 306.7, returns);
    const estimated = recovery.observations.filter((q) => q.estimatedPrice !== null);
    expect(path.slice(0, -1)).toHaveLength(19);
    path.slice(0, -1).forEach((p, i) => expect(p).toBeCloseTo(estimated[i].estimatedPrice!, 9));
    expect(new Set(estimated.map((q) => q.estimatedPrice)).size).toBe(19);
  });
  it('использует прошлое для обучения, 2025 только для test, не выбирает модель по test', () => {
    for (const f of recovery.folds) {
      if (f.trainTill) expect(f.trainTill < f.from).toBe(true);
      expect(f.phase === 'test').toBe(f.from >= '2025-01-01');
      expect([3, 10, 20]).toContain(f.length);
    }
    const rows = recovery.validation.filter(
      (q) => q.phase === 'validation' && q.mode === 'bridge' && q.length === null && q.eligible,
    );
    const best = rows.reduce((a, b) => (a.relativeRmse < b.relativeRmse ? a : b));
    expect(best.method).toBe(recovery.selectedMethod);
    expect(best.method).toBe('market');
    const test = recovery.validation.filter(
      (q) => q.phase === 'test' && q.mode === 'bridge' && q.length === null,
    );
    expect(test.reduce((a, b) => (a.relativeRmse < b.relativeRmse ? a : b)).method).toBe(
      'market-sector',
    );
  });
  it('MAE/RMSE блоков неотрицательны, RMSE не меньше MAE; коэффициенты конечны', () => {
    for (const f of recovery.folds) {
      expect(f.mae).toBeGreaterThanOrEqual(0);
      expect(f.rmse + 1e-10).toBeGreaterThanOrEqual(f.mae);
    }
    for (const m of recovery.models) {
      expect(m.coefficients.every(Number.isFinite)).toBe(true);
      expect(m.from >= '2022-03-29').toBe(true);
      expect(m.till).toBe('2024-02-15');
    }
  });
});
describe('Исследование отдельно от основной модели', () => {
  for (const kind of ['price', 'total'] as const)
    it(`возвращает февраль и март 2024 отдельными месячными интервалами: ${kind}`, () => {
      const before = marketResearch(data, kind, 2021, 0.1);
      const s = recoverySensitivity(data, recovery, kind, 2021, 0.1, 0.5);
      expect(s.before).toMatchObject(before);
      expect(s.before.pair.rows).toHaveLength(46);
      expect(s.after.pair.rows).toHaveLength(48);
      expect(s.addedMonths).toEqual(['2024-02-29', '2024-03-29']);
      for (const row of s.after.pair.rows) {
        const a = Number(row.from.slice(0, 4)) * 12 + Number(row.from.slice(5, 7));
        const b = Number(row.date.slice(0, 4)) * 12 + Number(row.date.slice(5, 7));
        expect(b - a).toBe(1);
      }
      expect(s.after.correlation).not.toBe(s.before.correlation);
      expect(s.after.stats.T!.cagr).toBeCloseTo(s.before.stats.T!.cagr!, 12);
      expect(researchMarket(data.market, recovery).dividends).toEqual(data.market.dividends);
      expect(marketResearch(data, kind, 2021, 0.1)).toEqual(before);
      expect(s.after.model!.points).toHaveLength(101);
      expect(s.after.model!.points[100].risk).toBeCloseTo(s.after.stats.SBER!.annualVol, 12);
      expect(s.after.model!.points[0].risk).toBeCloseTo(s.after.stats.T!.annualVol, 12);
    });
  it('Excel, CSV и PDF явно отделяют исходные котировки, оценки и контрфактические расчёты', () => {
    const model = createResearchModel(data, 'price', 2021, 0.1, 0.5, 500000, defaultScenarios, 5);
    const ctx = {
      data,
      model,
      kind: 'price' as const,
      start: 2021,
      rf: 0.1,
      weight: 0.5,
      amount: 500000,
      scenarios: defaultScenarios,
      horizon: 5,
    };
    const wb = buildWorkbook(XLSX, ctx);
    expect(wb.SheetNames).toHaveLength(25);
    const sheet = wb.Sheets['Котировки и оценки'];
    const index = recovery.observations.findIndex((q) => q.estimatedPrice !== null) + 2;
    expect(sheet[`B${index}`]).toBeUndefined();
    expect(sheet[`C${index}`].v).toBeGreaterThan(0);
    expect(sheet[`G${index}`].v).toBe(false);
    const csv = financialCSVRows(ctx);
    expect(csv.filter((row) => row[2] === 'Условная стоимость: восстановление')).toHaveLength(19);
    expect(
      csv
        .filter((row) => row[2] === 'Условная стоимость: восстановление')
        .every((row) => row[9] === 'Оценочное'),
    ).toBe(true);
    const html = reportHTML(ctx);
    expect(html).toContain('Исследование пропущенных котировок T');
    expect(html).toContain('stroke-dasharray="7 5"');
    expect(html).toContain(
      'Основные таблицы и модель Марковица используют только исходные фактические данные',
    );
    expect(html).toContain('https://www.moex.com/n94157');
  });
});

it('справочная LEGALCLOSEPRICE при нуле сделок не превращается в фактическую цену', () => {
  const inputs = JSON.parse(raw('recovery-inputs')) as {
    historyChecks: {
      rows: {
        TRADEDATE: string;
        NUMTRADES: number;
        CLOSE: number | null;
        LEGALCLOSEPRICE: number | null;
      }[];
    }[];
  };
  const reference = inputs.historyChecks
    .flatMap((c) => c.rows)
    .find((q) => q.TRADEDATE === '2024-02-16')!;
  expect(reference.NUMTRADES).toBe(0);
  expect(reference.CLOSE).toBeNull();
  expect(reference.LEGALCLOSEPRICE).toBeGreaterThan(0);
  const quote = recovery.observations.find((q) => q.date === '2024-02-16')!;
  expect(quote.actualPrice).toBeNull();
  expect(quote.estimatedPrice).not.toBe(reference.LEGALCLOSEPRICE);
  expect(quote.tradable).toBe(false);
});

it('ошибки контрольного скрытого блока воспроизводятся независимо в TypeScript', () => {
  const input = JSON.parse(raw('recovery-inputs')) as {
    index: { observations: { date: string; close: number }[] };
  };
  const fold = recovery.folds.find((q) => q.method === 'interpolation' && q.length === 3)!;
  const points = input.index.observations.filter((q) => q.date >= fold.from && q.date <= fold.till);
  const prices = new Map(market.quotes.map((q) => [q.date, q.T]));
  const estimated = logPriceBridge(
    prices.get(fold.leftAnchor)!,
    prices.get(fold.rightAnchor)!,
    fold.length + 1,
  );
  const errors = points.map((p, i) => estimated[i] - prices.get(p.date)!);
  expect(errors).toHaveLength(3);
  expect(errors.reduce((s, e) => s + Math.abs(e), 0) / 3).toBeCloseTo(fold.mae, 10);
  expect(Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / 3)).toBeCloseTo(fold.rmse, 10);
});

it('α, β и R² обучения совпадают с независимым расчётом по опубликованным факторам', () => {
  const input = JSON.parse(raw('recovery-inputs')) as {
    index: { observations: { date: string; close: number }[] };
  };
  const factors = input.index.observations;
  const m = recovery.models.find((q) => q.method === 'market')!;
  const prices = new Map(market.quotes.map((q) => [q.date, q.T]));
  const rows = factors.flatMap((q, i) => {
    if (i === 0 || q.date < m.from || q.date > m.till) return [];
    const previous = factors[i - 1],
      a = prices.get(previous.date),
      b = prices.get(q.date);
    const days = (Date.parse(q.date) - Date.parse(previous.date)) / 86400000;
    return a && b && days <= 7
      ? [{ x: Math.log(q.close / previous.close), y: Math.log(b / a) }]
      : [];
  });
  expect(rows).toHaveLength(m.n);
  const mx = rows.reduce((s, r) => s + r.x, 0) / rows.length,
    my = rows.reduce((s, r) => s + r.y, 0) / rows.length;
  const beta =
    rows.reduce((s, r) => s + (r.x - mx) * (r.y - my), 0) /
    rows.reduce((s, r) => s + (r.x - mx) ** 2, 0);
  const alpha = my - beta * mx;
  const r2 =
    1 -
    rows.reduce((s, r) => s + (r.y - alpha - beta * r.x) ** 2, 0) /
      rows.reduce((s, r) => s + (r.y - my) ** 2, 0);
  expect(beta).toBeCloseTo(m.coefficients[1], 12);
  expect(alpha).toBeCloseTo(m.coefficients[0], 12);
  expect(r2).toBeCloseTo(m.r2, 12);
});
