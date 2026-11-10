import { readFileSync, writeFileSync } from 'node:fs';
import { validateFinancial, validateMarket } from '../src/services/validation';
import { createResearchModel } from '../src/calculations/research';
import { scenariosForData, scenarioMethodology } from '../src/calculations/scenarios';
const read = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'));
const data = {
  financial: validateFinancial(read('financial')),
  market: validateMarket(read('market')),
};
const scenarios = scenariosForData(data.financial, data.market);
const cases = (['price', 'total'] as const).flatMap((kind) =>
  (['SBER', 'T'] as const).map((company) => {
    const model = createResearchModel(
      data,
      kind,
      2021,
      0.1,
      company === 'SBER' ? 1 : 0,
      500000,
      scenarios,
      5,
      'reinvest',
    );
    return {
      company,
      kind,
      amount: 500000,
      horizon: 5,
      from: model.period.from,
      till: model.period.till,
      historical: model.historyCalculation,
      volatility: model.portfolioStats?.annualVol,
      maxDrawdown: model.portfolioStats?.maxDrawdown,
      scenarioDividendMode: model.dividendMode,
      scenarios: model.projections.map((r) => ({
        id: r.id,
        value: r.value,
        profit: r.profit,
        cagr: r.cagr,
        path: r.path.map((q) => ({
          year: q.year,
          value: q.value,
          eps: q[company].eps,
          pe: q[company].pe,
          payout: q[company].payout,
          growth: q[company].growth,
        })),
      })),
    };
  }),
);
const audit = {
  method: scenarioMethodology,
  note: 'Исторический режим учитывает kind. Сценарии отдельно используют одинаковое для обеих компаний реинвестирование прогнозных дивидендов; переключатель исторической доходности не меняет финансовые предпосылки.',
  scenarios,
  cases,
};
writeFileSync(
  new URL('../docs/examples/calculator-comparison.json', import.meta.url),
  JSON.stringify(audit, null, 2) + '\n',
);
for (const c of cases) {
  console.log(
    c.company,
    c.kind,
    'history',
    c.historical?.cagr,
    c.historical?.value,
    c.historical?.profit,
  );
  for (const s of c.scenarios) console.log(s.id, s.cagr, s.value, s.profit);
}
