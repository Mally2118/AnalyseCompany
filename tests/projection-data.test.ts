import { it, expect, describe } from 'vitest';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { project, defaultPlan, type ProjectionPlans } from '../src/calculations/projection';
import { defaultScenarios, scenarioResult } from '../src/calculations/scenarios';
import { validateFinancial, validateMarket } from '../src/services/validation';
import { calculatedROA, reconstruction } from '../src/calculations/data-records';
import { interpolate, regressionEstimate } from '../src/calculations/econometrics';
import { createResearchModel } from '../src/calculations/research';
import { buildWorkbook, financialCSVRows, reportHTML } from '../src/utils/export';
import { metricHelp } from '../src/data/metric-help';
import katex from 'katex';
const data = {
  financial: validateFinancial(JSON.parse(readFileSync('public/data/financial.json', 'utf8'))),
  market: validateMarket(JSON.parse(readFileSync('public/data/market.json', 'utf8'))),
};
const eps = { SBER: 77.81, T: 68.872 },
  prices = { SBER: 299.9, T: 328 },
  positive = defaultScenarios[2];
describe('Годовая модель вместо повторения доходности 2026', () => {
  it('воспроизводит старые 18,97 млн и проверяет новую траекторию без подгонки', () => {
    const one = scenarioResult(positive, eps, prices, 0, 500000),
      p = project(positive, eps, prices, 0, 500000, 5, 'reinvest');
    expect(500000 * (1 + one.return) ** 5).toBeCloseTo(18971313.592284914, 5);
    expect(p.value).toBeCloseTo(2744272.3898175946, 6);
    expect(p.cagr).toBeCloseTo(0.40569610794405553, 12);
    expect(p.path.map((q) => q.T.growth)).toEqual([0, 35, 30, 25, 20, 15]);
    expect(p.path[2].T.price / p.path[1].T.price).toBeCloseTo(1.3, 12);
    expect(p.path[1].value).toBeCloseTo(one.value, 8);
  });
  it('первый год совпадает с EPS×P/E при любых весах и обоих режимах выплат', () => {
    for (const s of defaultScenarios)
      for (const w of [0, 0.37, 1])
        for (const mode of ['cash', 'reinvest'] as const) {
          const p = project(s, eps, prices, w, 100000, 1, mode);
          expect(p.value).toBeCloseTo(scenarioResult(s, eps, prices, w, 100000).value, 8);
          expect(p.path[1].T.eps).toBeCloseTo(eps.T * (1 + s.growthT / 100), 10);
        }
  });
  it('не начисляет переоценку P/E повторно при постоянной EPS и нулевых дивидендах', () => {
    const s = { ...positive, growthT: 0, peT: 2, payoutT: 0 },
      plans: ProjectionPlans = {
        [s.id]: {
          SBER: defaultPlan(s, 'SBER'),
          T: defaultPlan(s, 'T').map((a) => ({ ...a, growth: 0 })),
        },
      };
    const p = project(
      s,
      { SBER: 100, T: 100 },
      { SBER: 100, T: 100 },
      0,
      500,
      5,
      'reinvest',
      plans,
    );
    expect(p.path.slice(1).map((q) => q.value)).toEqual([1000, 1000, 1000, 1000, 1000]);
  });
  it('учитывает дивиденды один раз: деньги отдельно от реинвестированных акций', () => {
    const s = { ...positive, growthT: 0, peT: 1, payoutT: 10 },
      plans: ProjectionPlans = {
        [s.id]: {
          SBER: defaultPlan(s, 'SBER'),
          T: defaultPlan(s, 'T').map((a) => ({ ...a, growth: 0 })),
        },
      };
    const cash = project(s, { SBER: 100, T: 100 }, { SBER: 100, T: 100 }, 0, 500, 5, 'cash', plans),
      re = project(s, { SBER: 100, T: 100 }, { SBER: 100, T: 100 }, 0, 500, 5, 'reinvest', plans);
    expect(cash.value).toBeCloseTo(750);
    expect(cash.path.at(-1)!.T.shares).toBe(5);
    expect(cash.path.at(-1)!.T.cash).toBe(250);
    expect(re.value).toBeCloseTo(500 * 1.1 ** 5, 10);
    expect(re.path.at(-1)!.T.cash).toBe(0);
  });
  it('сплит меняет EPS и число акций взаимно, а не богатство', () => {
    const s = { ...positive, growthT: 0, peT: 1, payoutT: 0 },
      t = defaultPlan(s, 'T').map((a, i) => ({ ...a, growth: 0, shareFactor: i === 1 ? 10 : 1 })),
      plans: ProjectionPlans = { [s.id]: { SBER: defaultPlan(s, 'SBER'), T: t } };
    const p = project(s, { SBER: 100, T: 100 }, { SBER: 100, T: 100 }, 0, 500, 5, 'cash', plans);
    expect(p.path.map((q) => q.value)).toEqual([500, 500, 500, 500, 500, 500]);
    expect(p.path[2].T.shares).toBe(50);
    expect(p.path[2].T.eps).toBe(10);
  });
  it('годовая ручная предпосылка меняет результат; смена капитала масштабирует все суммы', () => {
    const a = project(positive, eps, prices, 0.2, 100000, 5, 'reinvest'),
      b = project(positive, eps, prices, 0.2, 200000, 5, 'reinvest');
    expect(b.value).toBeCloseTo(2 * a.value);
    expect(b.cagr).toBeCloseTo(a.cagr!);
    const t = defaultPlan(positive, 'T');
    t[2] = { ...t[2], pe: 4 };
    const p = project(positive, eps, prices, 0.2, 100000, 5, 'reinvest', {
      positive: { SBER: defaultPlan(positive, 'SBER'), T: t },
    });
    expect(p.path[3].value).not.toBeCloseTo(a.path[3].value);
    expect(p.value).not.toBeCloseTo(a.value);
  });
  it('не обрезает большие доходности, но отвергает некорректные параметры', () => {
    expect(
      project({ ...positive, peT: 100 }, eps, prices, 0, 100000, 1, 'cash').cagr,
    ).toBeGreaterThan(10);
    for (const h of [0, 11, 2.5])
      expect(() => project(positive, eps, prices, 0, 500000, h, 'cash')).toThrow();
  });
});
describe('Подтверждённые финансовые данные и методы', () => {
  it('EPS 2022/23 — фактическая базовая с одним делением на сплит', () => {
    for (const [year, value, raw] of [
      [2022, 10.559, 105.59],
      [2023, 40.508, 405.08],
    ]) {
      const f = data.financial.facts.find(
        (f) => f.company === 'T' && f.year === year && f.metric === 'eps',
      )!;
      expect(f.status).toBe('actual');
      expect(f.value).toBe(value);
      expect(f.provenance?.inputs[0].value).toBe(raw);
      expect(f.sourceId).toBe('t23full');
    }
  });
  it('ROA — прямой расчёт по входам, M&A не скрывается', () => {
    for (const [year, rounded] of [
      [2022, 1.43],
      [2023, 4.18],
      [2024, 3.31],
      [2025, 3.44],
    ]) {
      const f = calculatedROA(data.financial, 'T', year);
      expect(Number(f.value!.toFixed(2))).toBe(rounded);
      expect(f.status).toBe('calculated');
      expect(f.provenance?.inputs).toHaveLength(3);
    }
    expect(calculatedROA(data.financial, 'T', 2021).value).toBeNull();
    expect(
      data.financial.facts.find((f) => f.company === 'T' && f.year === 2025 && f.metric === 'roa')
        ?.value,
    ).toBeNull();
  });
  it('валютный эквивалент не выдаётся за брокерскую выплату и не меняет рыночную историю', () => {
    const f = data.financial.facts.find(
      (f) => f.company === 'T' && f.year === 2021 && f.metric === 'dividend',
    )!;
    expect(f.status).toBe('calculated');
    expect(f.value).toBe(17.82 / 10);
    expect(f.provenance?.inputs[0].value).toBe(0.24);
    expect(data.market.totalAvailableFrom.T).toBe('2021-12-30');
  });
  it('CIR отсутствует с объяснением; ни один факт не становится оценкой без оснований', () => {
    expect(
      data.financial.facts
        .filter((f) => f.company === 'T' && f.metric === 'cir')
        .every((f) => f.value === null && f.note.includes('состав')),
    ).toBe(true);
    expect(data.financial.facts.some((f) => f.status === 'estimated')).toBe(false);
  });
  it('интерполяция только одиночная внутренняя, не через Росбанк', () => {
    expect(interpolate(2022, { t: 2021, value: 10 }, { t: 2023, value: 14 })).toBe(12);
    expect(interpolate(2024, { t: 2023, value: 10 }, { t: 2025, value: 14 }, [2024])).toBeNull();
    expect(interpolate(2022, { t: 2020, value: 10 }, { t: 2024, value: 14 })).toBeNull();
    expect(interpolate(2025, { t: 2021, value: 10 }, { t: 2023, value: 14 })).toBeNull();
    expect(reconstruction(data.financial, 'T', 'interpolation').records).toHaveLength(0);
  });
  it('регрессия отвергает пять точек, плохую проверку и структурный разрыв', () => {
    expect(regressionEstimate([1, 2, 3, 4, 5], [2, 4, 6, 8, 10], 3).value).toBeNull();
    const x = Array.from({ length: 16 }, (_, i) => i + 1),
      y = x.map((v) => 2 + 3 * v);
    expect(regressionEstimate(x, y, 8).value).toBeCloseTo(26);
    expect(regressionEstimate(x, y, 8).r2).toBeCloseTo(1);
    expect(regressionEstimate(x, y, 8, true).value).toBeNull();
    expect(
      regressionEstimate(
        x,
        y.map((v, i) => (i > 11 ? -v : v)),
        8,
      ).value,
    ).toBeNull();
  });
  it('статусы, источники и формулы обязательны для расчётных данных', () => {
    const f = structuredClone(data.financial);
    f.facts.find((x) => x.status === 'calculated')!.provenance = undefined;
    expect(() => validateFinancial(f)).toThrow('Нет метода');
  });
});
it('все формулы справочника валидны для KaTeX и имеют обязательные поля', () => {
  expect(Object.keys(metricHelp).length).toBeGreaterThanOrEqual(36);
  for (const m of Object.values(metricHelp)) {
    expect(() =>
      katex.renderToString(m.latex, { throwOnError: true, strict: 'ignore' }),
    ).not.toThrow();
    for (const key of ['meaning', 'variables', 'example', 'interpretation', 'limitations'] as const)
      expect(m[key].length).toBeGreaterThan(10);
    expect(m.uses.length).toBeGreaterThan(0);
  }
});
it('экспорты сохраняют годовые формулы, статусы и результат новой модели', () => {
  const model = createResearchModel(data, 'total', 2023, 0.1, 0, 500000, defaultScenarios, 5),
    ctx = {
      data,
      model,
      kind: 'total' as const,
      start: 2023,
      rf: 0.1,
      weight: 0,
      amount: 500000,
      scenarios: defaultScenarios,
      horizon: 5,
    };
  const wb = buildWorkbook(XLSX, ctx);
  expect(wb.Sheets['Годовой прогноз'].G2.f).toBe('D2*(1+E2)/F2');
  expect(wb.Sheets['Прогноз портфеля'].C16.v).toBeCloseTo(model.projections[2].value, 6);
  expect(wb.Sheets['Прогноз портфеля'].F16.v).toBeCloseTo(model.projections[2].cagr!, 12);
  expect(financialCSVRows(ctx).some((r) => r[9] === 'Прогнозное')).toBe(true);
  const html = reportHTML(ctx);
  expect(html).toContain('Годовой прогноз инвестиции');
  expect(html).toContain('Расчётная ROA');
  expect(html).toContain('<math');
  expect(html).not.toContain('при постоянной сценарной ставке на весь горизонт');
});

it('ручная ячейка не замораживает другие параметры и компанию при изменении сценария 2026', () => {
  const changed = { ...positive, growthSBER: 30, growthT: 50 };
  const plans: ProjectionPlans = { positive: { T: [{}, { pe: 9 }] } };
  const p = project(changed, eps, prices, 0.5, 100000, 3, 'reinvest', plans);
  expect(p.path[2].T.pe).toBe(9);
  expect(p.path[2].T.growth).toBe(41.25);
  expect(p.path[2].SBER.growth).toBe(24.5);
  expect(p.path[3].T.pe).toBe(7);
});
