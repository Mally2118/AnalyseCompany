import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { buildWorkbook, csvString, reportHTML } from '../src/utils/export';
import type { ExportContext } from '../src/utils/export';
import { validateFinancial, validateMarket } from '../src/services/validation';
import { monthlyReturns, paired, statistics, wealthSeries } from '../src/calculations/market';
import { frontier } from '../src/calculations/portfolio';
import { correlation } from '../src/calculations/statistics';
import { conclusions } from '../src/calculations/analysis';
import { defaultScenarios, scenarioResult } from '../src/calculations/scenarios';
const read = (s: string): unknown =>
  JSON.parse(readFileSync(new URL(`../public/data/${s}.json`, import.meta.url), 'utf8'));
function context(kind: 'price' | 'total' = 'price'): ExportContext {
  const data = {
      financial: validateFinancial(read('financial')),
      market: validateMarket(read('market')),
    },
    rows = monthlyReturns(data.market, kind),
    pair = paired(rows),
    model = frontier(pair.SBER, pair.T, 0.1),
    wealth = {
      SBER: wealthSeries(data.market, 'SBER', kind),
      T: wealthSeries(data.market, 'T', kind),
    },
    stats = {
      SBER: statistics(
        rows.flatMap((r) => (r.SBER === null ? [] : [r.SBER])),
        0.1,
        wealth.SBER,
      ),
      T: statistics(
        rows.flatMap((r) => (r.T === null ? [] : [r.T])),
        0.1,
        wealth.T,
      ),
    },
    eps = { SBER: 77.81, T: 68.872 },
    results = defaultScenarios.map((s) =>
      scenarioResult(s, eps, { SBER: 299.9, T: 328 }, 0.5, 100000),
    );
  return {
    data,
    model: {
      rows,
      pair,
      model,
      wealth,
      stats,
      selected: model.points[50],
      correlation: correlation(pair.SBER, pair.T),
      results,
      conclusions: conclusions(data.financial, stats, model),
      eps,
    },
    kind,
    start: 2021,
    rf: 0.1,
    weight: 0.5,
    amount: 100000,
    scenarios: defaultScenarios,
    horizon: 1,
  };
}
it('создает читаемый XLSX с исходными пропусками, формулами и проверенными кэшированными значениями', () => {
  const ctx = context(),
    wb = buildWorkbook(XLSX, ctx),
    buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
    restored = XLSX.read(buffer, { type: 'buffer', cellFormula: true });
  expect(restored.SheetNames).toContain('Сценарные прогнозы');
  expect(restored.SheetNames).toHaveLength(13);
  const p = restored.Sheets['Марковиц'];
  expect(p.A2.v).toBe(0);
  expect(p.B2.f).toBe('1-A2');
  expect(p.D52.v).toBeCloseTo(ctx.model.model!.points[50].risk, 12);
  expect(p.E52.f).toContain('SQRT(12)');
  expect(restored.Sheets['Методика'].B6.v).toBeCloseTo(1.1 ** (1 / 12) - 1);
  expect(restored.Sheets['Риск и доходность'].G2.v).toBeCloseTo(ctx.model.stats.SBER!.sharpe!);
});
it('в полной доходности не добавляет дивиденд второй раз и сохраняет разрыв 2021 T', () => {
  const ctx = context('total'),
    wb = buildWorkbook(XLSX, ctx);
  const s = wb.Sheets['Цены и доходности'];
  expect(s.K2.v).toBe('');
  expect(s.J2.f).toBe('(H2-F2)/F2');
  expect(s.J2.f).not.toContain('дивиденд');
  expect(wb.Sheets['Марковиц'].A102.v).toBe(1);
});
it('CSV корректно экранирует кавычки, разделитель и переносы, сохраняет пропуск пустым', () => {
  expect(csvString([['a;b', 'a"b', null, 'строка\nвторая']])).toBe(
    '\uFEFF"a;b";"a""b";"";"строка\nвторая"',
  );
});
it('печатный PDF-отчет содержит все расчеты, графики, источники, ограничения и актуальные параметры', () => {
  const ctx = context(),
    html = reportHTML(ctx);
  expect(html).toContain('Сохранить PDF / печать');
  expect(html).toContain('68,872');
  expect(html).toContain('Нет данных');
  expect(html).toContain('Ковариационная');
  expect(html).toContain('<svg');
  expect(html).toContain('Приложение');
  expect(html).toContain('Негативный');
  expect(html).toContain('e-disclosure.ru');
  expect(reportHTML({ ...ctx, amount: 200000 })).not.toBe(html);
});
